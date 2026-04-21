export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export default async function handler(req, res) {
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    const file = files.image_file;

    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(file.filepath));

    try {
      const response = await fetch("https://sdk.photoroom.com/v1/segment", {
        method: "POST",
        headers: {
          "x-api-key": process.env.PHOTOROOM_API_KEY,
        },
        body: formData,
      });

      const buffer = await response.arrayBuffer();

      res.setHeader("Content-Type", "image/png");
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(500).json({ error: "Failed to process image" });
    }
  });
}
