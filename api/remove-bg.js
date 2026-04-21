export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        return res.status(500).json({ error: "Upload parse failed" });
      }

      const uploadedFile = Array.isArray(files.image_file)
        ? files.image_file[0]
        : files.image_file;

      if (!uploadedFile) {
        return res.status(400).json({ error: "No image file received" });
      }

      const fileBuffer = fs.readFileSync(uploadedFile.filepath);

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: uploadedFile.mimetype || "image/jpeg" });
      formData.append("image_file", blob, uploadedFile.originalFilename || "upload.jpg");

      const response = await fetch("https://sdk.photoroom.com/v1/segment", {
        method: "POST",
        headers: {
          "x-api-key": process.env.PHOTOROOM_API_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", "image/png");
      return res.status(200).send(buffer);
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to process image" });
    }
  });
}
