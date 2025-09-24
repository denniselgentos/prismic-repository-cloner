import {
  downloadAsset,
  uploadAsset,
  getReadToken,
  getWriteToken,
} from "@/lib/assets";

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export default async function handler(req, res) {
  switch (req.method) {
    case "GET":
      try {
        // For fetching assets from source repository, we can use the public API
        // or the Write API Key if it has read permissions
        const sourceRepo = process.env.Source_Repo;

        if (!sourceRepo) {
          return res.status(400).json({
            reason: "Source_Repo environment variable is not set",
          });
        }

        const myHeaders = new Headers();
        myHeaders.append("repository", sourceRepo);

        // Use read token for source repository
        try {
          const token = await getReadToken();
          myHeaders.append("Authorization", `Bearer ${token}`);
        } catch (tokenError) {
          console.log(
            "Failed to get read token, trying without authentication for public repository"
          );
        }

        const requestOptions = {
          method: "GET",
          headers: myHeaders,
          redirect: "follow",
        };

        const ans = await fetch(
          "https://asset-api.prismic.io/assets?limit=1000",
          requestOptions
        );

        if (!ans.ok) {
          return res.status(ans.status).json({
            reason: "Failed to fetch assets",
            status: ans.status,
            statusText: ans.statusText,
          });
        }

        const assets = await ans.text();
        return res.status(200).json({ assets });
      } catch (err) {
        console.log(err);
        return res.status(400).json({ reason: "server error", err });
      }
    //Download assets
    case "POST":
      try {
        const { assets } = req.body;

        // Check if assets and assets.items exist
        if (!assets || !assets.items || !Array.isArray(assets.items)) {
          return res.status(400).json({
            reason: "Invalid assets data",
            err: "assets.items is not an array or is undefined",
          });
        }

        for (let i = 0; i < assets.items.length; i++) {
          if (!assets.items[i]?.url) {
            console.log(assets.items[i]);
            continue;
          }
          await downloadAsset(
            assets.items[i].url,
            assets.items[i].id,
            assets.items[i].filename
          );
        }
        return res.status(200).json({ reason: "done" });
      } catch (err) {
        console.log(err);
        return res.status(400).json({ reason: "server error", err });
      }
    case "PUT":
      try {
        const { assets } = req.body;
        const newAssets = [];
        const token = await getWriteToken();

        // Check if assets and assets.items exist
        if (!assets || !assets.items || !Array.isArray(assets.items)) {
          return res.status(400).json({
            reason: "Invalid assets data",
            err: "assets.items is not an array or is undefined",
          });
        }

        for (let i = 0; i < assets.items.length; i++) {
          await uploadAsset(
            assets.items[i].id,
            assets.items[i].filename,
            token,
            assets,
            newAssets,
            i
          );

          //wait 1s
          await delay(1500);
        }

        return res.status(200).json({ newAssets });
      } catch (err) {
        console.log(err);
        return res.status(400).json({ reason: "server error", err });
      }
    default:
      return res.status(500).json({ reason: "Not allowed" });
  }
}
