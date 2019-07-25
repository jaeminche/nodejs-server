"use strict";

const express = require("express");
const app = express();
const axios = require("axios");
const Path = require("path");
const file = require("file-system");
const Fs = require("fs");

app.use(express.json());

const getData = async url => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    return error;
  }
};

const downloadImage = async (url, filename) => {
  const path = Path.resolve(__dirname, "images", `${filename}.plain`);
  const writer = Fs.createWriteStream(path);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream"
  });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

//READ Request Handlers
app.get("/", (req, res) => {
  res.send("Welcome to Jae's REST API with Node.js");
});

// make a request and returns an user JSON representation
app.get("/api/user/:userId", async (req, res) => {
  const url = `https://reqres.in/api/users/${req.params.userId}`;
  const retrieved = await getData(url);
  res.send(retrieved);
});

// make a request to get the image by `avatar` URL
app.get("/api/user/:userId/avatar", async (req, res) => {
  const url = `https://reqres.in/api/users/${req.params.userId}`;
  const retrievedUser = await getData(url);
  const avatarUrl = retrievedUser.data.avatar;
  // Save the image into the FileSystem (plain file)
  const filename = `${retrievedUser.data.id}_${retrievedUser.data.first_name}_${
    retrievedUser.data.last_name
  }`;
  const path = `images/${filename}.plain`;
  // When another request with the same URL comes in or when the file already exists, the server should not make a HTTP call to get the image
  if (!Fs.existsSync(path)) {
    const retrievedAvatar = await downloadImage(avatarUrl, filename);
  }
  // return base64 representation
  const base64str = base64_encode(`images/${filename}.plain`);
  res.send(base64str);

  // function to encode file data to base64 encoded string
  function base64_encode(file) {
    // read data
    const data = Fs.readFileSync(file);
    // convert data to base64 encoded string
    return new Buffer(data).toString("base64");
  }
});

//DELETE Request Handler
app.delete("/api/user/:userId/avatar", async (req, res) => {
  const url = `https://reqres.in/api/users/${req.params.userId}`;
  const retrievedUser = await getData(url);
  // Save the image into the FileSystem (plain file)
  const filename = `${retrievedUser.data.id}_${retrievedUser.data.first_name}_${
    retrievedUser.data.last_name
  }`;
  const path = `images/${filename}.plain`;
  // When another request with the same URL comes in or when the file already exists, the server should not make a HTTP call to get the image
  if (Fs.existsSync(path)) {
    // Fs.unlinkSync(path);
    Fs.unlink(path, function() {});
    res.send(`'${path}' has been deleted.`);
  } else {
    const avatarUrl = retrievedUser.data.avatar;
    const retrievedAvatar = await downloadImage(avatarUrl, filename);
    res.send(
      `No such image file! The image you've requested to delete has been saved as '${path}'`
    );
  }
});

// ## Part two - implement a CRON job to scrap the users (IIFE)
(function scrap() {
  let page = 1;
  let usersList, retrievedUsers, url, data;
  const path = "api/usersList.json";
  async function storeUsersList() {
    try {
      url = `https://reqres.in/api/users?page=${page}`;
      retrievedUsers = await getData(url);
      if (Fs.existsSync(path)) {
        data = Fs.readFileSync(path, "utf8");
        usersList = JSON.parse(data);
        if (!retrievedUsers.data.length > 0) stopCron();
      } else {
        usersList = { data: [] };
        if (!retrievedUsers.data.length > 0) stopCron();
      }
    } catch (ex) {
      console.log(`something went wrong ${ex}`);
    } finally {
      usersList["data"] = [...usersList["data"], ...retrievedUsers["data"]];
      let tempJson = JSON.stringify(usersList);
      Fs.writeFile(path, tempJson, "utf8", function(err) {
        if (err) throw err;
      });
      page++;
    }
  }

  const cronId = setInterval(storeUsersList, 60000);
  function stopCron() {
    clearInterval(cronId);
  }
})();

const port = 3000;
app.listen(port, () => console.log(`Listening on port ${port}..`));
