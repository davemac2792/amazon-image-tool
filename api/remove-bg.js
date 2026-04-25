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

      const blob = new Blob([fileBuffer], {
        type: uploadedFile.mimetype || "image/jpeg",
      });

      const formData = new FormData();
      formData.append("imageFile", blob, uploadedFile.originalFilename || "upload.jpg");
      formData.append("background.color", "FFFFFF");

      const response = await fetch("https://image-api.photoroom.com/v2/edit", {
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
      const photoroomBuffer = Buffer.from(arrayBuffer);

      // Trim white padding around the subject
      let trimmedBuffer;

      try {
        trimmedBuffer = await sharp(photoroomBuffer)
          .trim({
            background: "#FFFFFF",
            threshold: 12,
          })
          .png()
          .toBuffer();
      } catch {
        trimmedBuffer = photoroomBuffer;
      }

      // Resize subject so it fills about 85% of 2000x2000
      const resizedSubject = await sharp(trimmedBuffer)
        .resize({
          width: 1700,
          height: 1700,
          fit: "inside",
          withoutEnlargement: false,
        })
        .png()
        .toBuffer();

      const metadata = await sharp(resizedSubject).metadata();

      const left = Math.round((2000 - metadata.width) / 2);
      const top = Math.round((2000 - metadata.height) / 2);

      // Place trimmed/resized subject on final white Amazon-ready canvas
      const finalImage = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          {
            input: resizedSubject,
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
