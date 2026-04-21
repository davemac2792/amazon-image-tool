export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";
import sharp from "sharp";

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
      const blob = new Blob([fileBuffer], {
        type: uploadedFile.mimetype || "image/jpeg",
      });

      formData.append(
        "imageFile",
        blob,
        uploadedFile.originalFilename || "upload.jpg"
      );

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

      const segmentedArrayBuffer = await response.arrayBuffer();
      const segmentedBuffer = Buffer.from(segmentedArrayBuffer);

      // Resize the cutout so it fits within 85% of a 2000x2000 canvas
      const resizedCutout = await sharp(segmentedBuffer)
        .resize({
          width: 1700,
          height: 1700,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

      const metadata = await sharp(resizedCutout).metadata();
      const left = Math.round((2000 - (metadata.width || 0)) / 2);
      const top = Math.round((2000 - (metadata.height || 0)) / 2);

      const finalImage = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([
          {
            input: resizedCutout,
            left,
            top,
          },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

      res.setHeader("Content-Type", "image/jpeg");
      return res.status(200).send(finalImage);
    } catch (error) {
      return res.status(500).json({
        error: error.message || "Failed to process image",
      });
    }
  });
}
