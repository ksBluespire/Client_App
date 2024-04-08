const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const cors = require("cors");



const app = express();
const port = 4000;
app.use(cors());
require('dotenv').config();

AWS.config.update({
  region: "us-east-1", // Update with your DynamoDB region
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// AWS.config.update({
//   region: "us-east-1", // Update with your DynamoDB region
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
// });

const docClient = new AWS.DynamoDB.DocumentClient();

// Middleware
app.use(bodyParser.json());

// POST route to submit form data
app.post("/submitFormData", (req, res) => {
  const formData = req.body;
  console.log(formData);

  // Check if the user ID already exists in the DynamoDB table
  const params = {
    TableName: "client_app",
    Key: {
      pk: formData.userId,
    },
  };

  docClient.get(params, (err, data) => {
    if (err) {
      console.error("Error retrieving user data:", err);
      return res.status(500).send("Error retrieving user data");
    }

    if (data.Item) {
      // If the user exists, update the record to include the new organization
      const existingOrganizations = data.Item.organizationArray
        ? data.Item.organizationArray.L.map((org) => org.S)
        : [];
      const newOrganizations = [
        ...new Set([...existingOrganizations, ...formData.organizationArray]),
      ]; // Merge and remove duplicates

      const updateParams = {
        TableName: "client_app",
        Key: {
          pk: formData.userId,
          //   sk: formData.organizationId
        },
        UpdateExpression: "SET organizationArray = :newOrganizations",
        ExpressionAttributeValues: {
          ":newOrganizations": {
            L: newOrganizations.map((org) => ({ S: org })),
          },
        },
        ReturnValues: "ALL_NEW",
      };

      docClient.update(updateParams, (err, data) => {
        if (err) {
          console.error("Error updating user data:", err);
          return res.status(500).send("Error updating user data");
        }

        console.log("User data updated successfully:", data);
        res.send("User data updated successfully");
      });
    } else {
      // If the user doesn't exist, create a new record
      const createParams = {
        TableName: "client_app",
        Item: {
          firstname: formData.firstname,
          lastname: formData.lastname,
          roletype: formData.roleType,
          partnerId:formData.partnerId,
          pk: formData.userId,
          organizationArray: formData.organizationArray.map((org) => ({
            S: org,
          })),
          userId: formData.userId,
        },
      };

      docClient.put(createParams, (err, data) => {
        if (err) {
          console.error("Error creating user data:", err);
          return res.status(500).send("Error creating user data");
        }
         
        console.log("User data created successfully:", data);
        res.status(200).json({ userId: formData.userId, message: "User data created successfully" });
      });
    }
  });
});



app.get("/getOrganizations/:userId", (req, res) => {
  const userId = req.query.userId;

  // Define parameters for DynamoDB query
  const params = {
    TableName: "client_app",
    Key: {
      pk: userId,
    },
  };

  // Query DynamoDB to retrieve organization array
  docClient.get(params, (err, data) => {
    if (err) {
      console.error("Error retrieving organization data:", err);
      return res.status(500).send("Error retrieving organization data");
    }

    if (!data.Item || !data.Item.organizationArray) {
      return res.status(404).send("Organization data not found");
    }

    const organizationArray = data.Item.organizationArray.map(org => org.S);
    res.json({ organizationArray });
  });
});



app.get("/getAllUserIDs", (req, res) => {

  const params = {
    TableName: "client_app",
    ProjectionExpression: "pk", 
  };


  docClient.scan(params, (err, data) => {
    if (err) {
      console.error("Error retrieving userIDs:", err);
      return res.status(500).send("Error retrieving userIDs");
    }

    if (!data.Items || data.Items.length === 0) {
      return res.status(404).send("No userIDs found");
    }

   
    const userIDs = data.Items.map(item => item.pk);

  
    res.json({ userIDs });
  });
});


// GET route to retrieve all fields based on user ID
app.get("/getUserData/:userId", (req, res) => {
  const userId = req.query.userId;

  // Define parameters for DynamoDB query
  const params = {
    TableName: "client_app",
    Key: {
      pk: userId,
    },
  };

  // Query DynamoDB to retrieve user data
  docClient.get(params, (err, data) => {
    if (err) {
      console.error("Error retrieving user data:", err);
      return res.status(500).send("Error retrieving user data");
    }

    if (!data.Item) {
      return res.status(404).send("User data not found");
    }

    // Extract user data from DynamoDB response
    const userData = {
      firstname: data.Item.firstname,
      lastname: data.Item.lastname,
      roletype: data.Item.roletype,
      partnerId: data.Item.partnerId,
      organizationArray: data.Item.organizationArray.map(org => org.S),
      userId: data.Item.userId,
    };

    res.json(userData);
  });
});






// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});