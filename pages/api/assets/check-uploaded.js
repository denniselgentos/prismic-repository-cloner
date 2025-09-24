import { checkUploadedAssets } from "@/lib/assets";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reason: "Method not allowed" });
  }

  try {
    const { assets } = req.body;

    if (!assets || !assets.items) {
      return res.status(400).json({ reason: "Invalid assets data" });
    }

    const allUploaded = await checkUploadedAssets(assets);

    return res.status(200).json({ allUploaded });
  } catch (err) {
    console.log("Error checking uploaded assets:", err);
    // Return false instead of error to prevent frontend crashes
    return res.status(200).json({ allUploaded: false });
  }
}
