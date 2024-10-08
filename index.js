const axios = require('axios');
var payloads=require('./payload');
const fs = require('fs');
require('dotenv').config();
const CLIENT_ID =process.env.CLIENT_ID;
const CLIENT_SECRET =process.env.CLIENT_SECRET;
const vt = require("./videototext")


// Generates token with clientid and client secret
async function getToken(CLIENT_ID, CLIENT_SECRET) {
    const BASE_URL = process.env.BASE_URL;
    const AUTH_ROUTE = process.env.AUTH_ROUTE;
    const url = `${BASE_URL}${AUTH_ROUTE}`;
    const authPayload = payloads.createAuthTokenPayload(CLIENT_ID, CLIENT_SECRET);
    const payload = JSON.stringify(authPayload);
    const headers = payloads.setAuthHeaders();
  
    try {
      let response =await axios.post(url,payload,{
        headers: headers
      })
      return response.data.access_token;
    } catch (e) {
      console.error(`Error while fetching token: ${e}`);
      return null;
    }
  }
  
  async function generateUploadUrl(token) {
    const BASE_URL = process.env.BASE_URL;
    const GENERATEURL_ROUTE = process.env.GENERATEURL_ROUTE;
    const USER_ID = process.env.USER_ID;
    const url = `${BASE_URL}${GENERATEURL_ROUTE}`;
    const headers = payloads.setHeaders(token, USER_ID);
    const generateUrlPayload = payloads.createGenerateUrlPayload('testvideo.mp4');
    const payload = JSON.stringify(generateUrlPayload);
  
    try {
      let response = await axios.post(url,payload, {
        headers: headers
      });
      return response.data.data;
    } catch (e) {
      console.error(`Error while generate url: ${e}`);
      return null;
    }
  }
  // Upload video function
  async function uploadVideo(url, videoFile) {
    const headers = { "Content-Type": "video/mp4" };
    const videoData = await new Promise((resolve, reject) => {
      const filePath = videoFile.path;
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    try {
      let response = await axios.put(url, videoData, { headers });
      console.log("Video uploaded successfully!");
      return response;
    } catch (e) {
      console.error(`Error uploading video: ${e}`);
    }
  }

  // Create transcription function
  async function createTranscription(token, fileUrl, language) {
    const BASE_URL = process.env.BASE_URL;
    const TRANSCRIPTION_ROUTE = process.env.TRANSCRIPTION_ROUTE;
    const USER_ID = process.env.USER_ID;
    const WEBHOOK_URL = process.env.WEBHOOK_URL;
    const url = `${BASE_URL}${TRANSCRIPTION_ROUTE}`;
    const transcriptionPayload = payloads.createTranscriptionPayload(
      fileUrl,
      language,
      WEBHOOK_URL
    );
    const headers = payloads.setHeaders(token, USER_ID);

    try {
      let response = await axios.post(url, transcriptionPayload, { headers });
      const jobId = response.data.data.jobId;
      return jobId;
    } catch (e) {
      console.error(`Error while storyboard: ${e}`);
      return null;
    }
  }

  // Get job status function
  async function getJobId(token, jobId) {
    const BASE_URL = process.env.BASE_URL;
    const GET_JOB_ROUTE = process.env.GET_JOB_ROUTE;
    const USER_ID = process.env.USER_ID;
    const url = `${BASE_URL}${GET_JOB_ROUTE}${jobId}`;
    const headers = payloads.setHeaders(token, USER_ID);

    try {
      let response = await axios.get(url, { headers });
      return response.data.data;
    } catch (e) {
      console.error(`Error while get jobid: ${e}`);
      return null;
    }
  }

  // Calls render endpoint with payload came from storyboard and returns jobid as output
  async function createHighlights(token, transcriptdata) {
    const BASE_URL = process.env.BASE_URL;
    const HIGHLIGHTS_ROUTE = process.env.HIGHLIGHTS_ROUTE;
    const WEBHOOK_URL = process.env.WEBHOOK_URL;
    const USER_ID = process.env.USER_ID;
    const url = BASE_URL + HIGHLIGHTS_ROUTE;
    const renderRequestPayload = payloads.createHighlightsPayload(
      transcriptdata.transcript,
      60,
      WEBHOOK_URL
    );
    const headers = payloads.setHeaders(token, USER_ID);
    const payload = JSON.stringify(renderRequestPayload);
    try {
      let response = await axios.post(url, payload, {
        headers: headers,
      });
      return response.data.data.jobId;
    } catch (e) {
      console.error(`Error while highlights: ${e}`);
      return null;
    }
  }

  // Calls storyboard API with payload present in payload.js and returns jobid as output
  async function createPreviewStoryboard(token, fileUrl, highlightData) {
    const BASE_URL = process.env.BASE_URL;
    const STORYBOARD_ROUTE = process.env.STORYBOARD_ROUTE;
    const USER_ID = process.env.USER_ID;
    const url = `${BASE_URL}${STORYBOARD_ROUTE}`;
    const textToVideoPayload = payloads.prepareStoryboardPayload(
      fileUrl,
      highlightData
    );
    const headers = payloads.setHeaders(token, USER_ID);

    try {
      const response = await axios.post(url, textToVideoPayload, { headers });
      return response.data.jobId;
    } catch (error) {
      console.error(`Error while storyboard: ${error}`);
      return null;
    }
  }

  // Calls render endpoint with payload came from storyboard and returns jobid as output
  async function createVideoRender(token, renderData) {
    const BASE_URL = process.env.BASE_URL;
    const RENDER_ROUTE = process.env.RENDER_ROUTE;
    const USER_ID = process.env.USER_ID;
    const url = BASE_URL + RENDER_ROUTE;
    const renderRequestPayload = payloads.createRenderPayload(
      renderData.audio,
      renderData.output,
      renderData.scenes
    );
    const headers = payloads.setHeaders(token, USER_ID);
    try {
      const response = await axios.post(url, renderRequestPayload, { headers });
      let data = await response.data.data;
      const jobid = data.job_id;
      return jobid;
    } catch (e) {
      console.error(`Error while render: ${e}`);
      return null;
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  // Download the final video generated
  async function downloadVideo(url, path) {
    const destination = path;
    const writer = fs.createWriteStream(destination);
    const response = await axios.get(url, { responseType: "stream" });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }

  async function waitForJobToComplete(jobName, token, jobid, pollDuration) {
    do {
      response = await getJobId(token, jobid);
      if (response.status === "in-progress") {
        console.log(
          `Please wait, ${jobName} job with jobId ${jobid} is still in progress...`
        );
        await wait(pollDuration * 1000); // Wait for `pollDuration` seconds before checking again
      }
    } while (response.status === "in-progress");
    return response;
  }

  async function createFinalHighlights(videoFile) {
    const token = await getToken(CLIENT_ID, CLIENT_SECRET);

    console.log("Step 1/7 Status: Uploading Video...");
    const data = await generateUploadUrl(token);
    await uploadVideo(data.signedUrl, videoFile);

    console.log("Step 2/7 Status: Generating Transcription");
    const jobid = await createTranscription(token, data.url, "en-US");
    const transcriptiondata = await waitForJobToComplete(
      "transcription",
      token,
      jobid,
      10
    );

    console.log("Step 3/7 Status: Generating Highlights");
    const highlightjobid = await createHighlights(token, transcriptiondata);
    const highlightdata = await waitForJobToComplete(
      "highlights",
      token,
      highlightjobid,
      10
    );

    const storyboardJobId = await createPreviewStoryboard(
      token,
      data.url,
      highlightdata
    );

    console.log("Step 4/7 Status: Waiting for Video Preview.");
    const renderData = await waitForJobToComplete(
      "storyboard",
      token,
      storyboardJobId,
      10
    );

    console.log(
      "Step 5/7 : Status: in-progress sending Video Generation Request."
    );
    const rander_jobid = await createVideoRender(
      token,
      renderData.renderParams
    );

    console.log(
      "Step 6/7: Video generation Request Sent. now waiting for video generation to complete video"
    );
    const renderResponse = await waitForJobToComplete(
      "render",
      token,
      rander_jobid,
      10
    );
    console.log("finalized", renderResponse.shareVideoURL);
    return renderResponse.shareVideoURL;
    
  }

  // ("h.mp4", "C:\\Users\\Abel\\Downloads\\");
  const express = require("express");
  const bodyParser = require("body-parser");
  const multer = require("multer");
  // Configure multer to accept a single file with the field name 'videoFile'
  const upload = multer({ dest: "uploads/" }).single("videoFile");
  const cors = require("cors");
  const app = express();
  app.use(bodyParser.json());
  app.use(cors());
  app.use(
    cors({
      origin: "*", // Allow all origins
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      allowedHeaders: "Content-Type, Authorization",
    })
  );

  const port = 3000;

  app.post("/hl-video", async (req, res) => {
    try {
      // Wrap multer upload in a promise
      await new Promise((resolve, reject) => {
        upload(req, res, function (err) {
          if (err instanceof multer.MulterError) {
            reject({ status: 400, message: err.message });
          } else if (err) {
            reject({ status: 500, message: err.message });
          } else if (!req.file) {
            reject({ status: 400, message: "No video file sent." });
          } else if (!req.file.mimetype.startsWith("video/")) {
            reject({
              status: 400,
              message: "Uploaded content is not a video.",
            });
          } else {
            // Resolve promise if upload was successful
            resolve(req.file);
          }
        });
      });

      // At this point, req.file is guaranteed to be a video file
      const videoFile = req.file;

      // Call  with videoFile
      const transcriptionText = await createFinalHighlights(videoFile);

      // Send transcription text in response
      return res.json({ transcriptionText });
    } catch ({ status, message }) {
      // Handle errors
      console.error(message);
      return res
        .status(status || 500)
        .send(message || "Failed to process the video transcription.");
    }
  });

  app.post("/transcribe-video", async (req, res) => {
    try {
      // Wrap multer upload in a promise
      await new Promise((resolve, reject) => {
        upload(req, res, function (err) {
          if (err instanceof multer.MulterError) {
            reject({ status: 400, message: err.message });
          } else if (err) {
            reject({ status: 500, message: err.message });
          } else if (!req.file) {
            reject({ status: 400, message: "No video file sent." });
          } else if (!req.file.mimetype.startsWith("video/")) {
            reject({
              status: 400,
              message: "Uploaded content is not a video.",
            });
          } else {
            // Resolve promise if upload was successful
            resolve(req.file);
          }
        });
      });

      // At this point, req.file is guaranteed to be a video file
      const videoFile = req.file;

      // Call  with videoFile
      const transcriptionText = await vt.createFinalTranscription(videoFile);

      // Send transcription text in response
      return res.json({ transcriptionText });
    } catch ({ status, message }) {
      // Handle errors
      console.error(message);
      return res
        .status(status || 500)
        .send(message || "Failed to process the video transcription.");
    }
  });

  // Start the server
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
  });
