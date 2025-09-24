import { checkAllAssetsExist } from "@/lib/assets";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reason: "Method not allowed" });
  }

  try {
    const { assets } = req.body;

    if (!assets || !assets.items) {
      return res.status(400).json({ reason: "Invalid assets data" });
    }

    const allExist = checkAllAssetsExist(assets);

    return res.status(200).json({ allExist });
  } catch (err) {
    console.log("Error checking assets:", err);
    return res.status(500).json({ reason: "Server error", err: err.message });
  }
}
