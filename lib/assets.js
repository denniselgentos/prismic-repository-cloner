const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");
const FormData = require("form-data");

// The path of the directory to save the image
const dirPath = "./images";

export const downloadAsset = async (imageUrl, imageId, imageName) => {
  return new Promise((resolve, reject) => {
    // Check if asset already exists
    if (checkAssetExists(imageId, imageName)) {
      console.log(`Asset ${imageName} already exists, skipping download`);
      resolve({ msg: `Asset ${imageName} already exists, skipped` });
      return;
    }

    //create folder with image id to avoid files with same name
    const folderName = `${dirPath}/${imageId}`;
    try {
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }
    } catch (err) {
      console.error(err);
    }

    const file = fs.createWriteStream(path.join(folderName, imageName));
    https
      .get(imageUrl, async (response) => {
        response.pipe(file);

        file.on("finish", () => {
          file.close();
          console.log(`Image downloaded as ${imageName}`);
          resolve({ msg: `Image downloaded as ${imageName}` });
        });
      })
      .on("error", (err) => {
        fs.unlink(imageName);
        console.error(`Error downloading image: ${err.message}`);
        reject({ err: `Error downloading image: ${err.message}` });
      });
  });
};

export const uploadAsset = async (
  fileId,
  filename,
  writeToken,
  assets,
  newAssets,
  i
) => {
  return new Promise((resolve, reject) => {
    // Check required environment variables
    if (!process.env.Destination_Repo) {
      reject({ err: "Destination_Repo environment variable is not set" });
      return;
    }

    if (!process.env.Project_Path) {
      reject({ err: "Project_Path environment variable is not set" });
      return;
    }

    let data = new FormData();
    data.append(
      "file",
      fs.createReadStream(
        `${process.env.Project_Path}/images/${fileId}/${filename}`
      )
    );

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://asset-api.prismic.io/assets",
      headers: {
        repository: process.env.Destination_Repo,
        Authorization: `Bearer ${writeToken}`,
        ...data.getHeaders(),
      },
      data: data,
    };

    axios
      .request(config)
      .then((response) => {
        console.log(JSON.stringify(response.data));
        newAssets.push({ ...response.data, prevID: assets.items[i].id });
        resolve({ msg: JSON.stringify(response.data) });
      })
      .catch((error) => {
        console.log(error);
        reject({ err: error });
      });
  });
};

export const checkAssetExists = (imageId, imageName) => {
  const folderName = `${dirPath}/${imageId}`;
  const filePath = path.join(folderName, imageName);
  return fs.existsSync(filePath);
};

export const checkAllAssetsExist = (assets) => {
  if (!assets || !assets.items) return false;

  return assets.items.every((asset) => {
    if (!asset?.url || !asset?.id || !asset?.filename) return false;
    return checkAssetExists(asset.id, asset.filename);
  });
};

// Get Write API Key for destination repository (uploading assets)
export const getWriteToken = async () => {
  const writeApiKey = process.env.Prismic_Write_API_Key;

  if (!writeApiKey) {
    throw new Error(
      "Prismic_Write_API_Key environment variable is not set. Please add it to your .env.local file."
    );
  }

  return writeApiKey;
};

// Get authenticated token for destination repository
export const getDestinationToken = async () => {
  const authResponse = await fetch("https://auth.prismic.io/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: process.env.Prismic_Email,
      password: process.env.Prismic_Password,
    }),
  });

  if (!authResponse.ok) {
    throw new Error(
      `Failed to authenticate for destination repository: ${authResponse.status} ${authResponse.statusText}`
    );
  }

  const token = await authResponse.text();
  return token;
};

// Get read token for source repository (downloading assets)
export const getReadToken = async () => {
  const authResponse = await fetch("https://auth.prismic.io/login", {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({
      email: process.env.Repo_Login_Email,
      password: process.env.Repo_Login_Password,
    }),
  });

  if (!authResponse.ok) {
    throw new Error(
      `Failed to authenticate with source repository: ${authResponse.status} ${authResponse.statusText}`
    );
  }

  const token = await authResponse.text();
  return token;
};

// Legacy function for backward compatibility - now uses read token
export const getToken = async () => {
  return await getReadToken();
};

// Check if assets are already uploaded to the destination repository
export const checkUploadedAssets = async (assets) => {
  if (!assets || !assets.items) return false;

  try {
    // Check if destination repository is set
    if (!process.env.Destination_Repo) {
      throw new Error("Destination_Repo environment variable is not set");
    }

    // Use write token for destination repository (same as uploadAsset function)
    const token = await getWriteToken();
    console.log("Using write token for destination repository check");

    // Query the destination repository for assets with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      "https://asset-api.prismic.io/assets?limit=1000",
      {
        method: "GET",
        headers: {
          repository: process.env.Destination_Repo,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(
        `Failed to fetch assets from destination repository: ${response.status} ${response.statusText}`
      );
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );
      // If we can't access the destination repository, assume no assets are uploaded
      return false;
    }

    // The API returns text that needs to be parsed, similar to the source assets API
    const uploadedAssetsText = await response.text();
    console.log("Destination API response length:", uploadedAssetsText.length);
    console.log(
      "First 200 chars of response:",
      uploadedAssetsText.substring(0, 200)
    );

    // Handle empty response
    if (!uploadedAssetsText || uploadedAssetsText.trim() === "") {
      console.log("Empty response from destination repository");
      return false;
    }

    let uploadedAssets;
    try {
      uploadedAssets = JSON.parse(uploadedAssetsText);
      console.log("Successfully parsed destination assets response");
    } catch (parseError) {
      console.log("Failed to parse API response:", parseError);
      return false;
    }

    // Check if the response has the expected structure
    // The destination API returns {total: number, items: array} instead of just an array
    if (
      !uploadedAssets ||
      !uploadedAssets.items ||
      !Array.isArray(uploadedAssets.items)
    ) {
      console.log(
        "Unexpected API response structure:",
        typeof uploadedAssets,
        uploadedAssets
      );
      // If the destination repository is empty, return false (no assets uploaded)
      if (uploadedAssets === null || uploadedAssets === undefined) {
        console.log("Destination repository appears to be empty");
        return false;
      }
      return false;
    }

    // Extract the items array from the response
    const uploadedAssetsList = uploadedAssets.items;

    // Handle empty array case
    if (uploadedAssetsList.length === 0) {
      console.log("Destination repository has no assets");
      return false;
    }

    // Create a set of uploaded asset filenames for quick lookup
    // Asset IDs change when uploaded to destination, but filenames remain the same
    const uploadedFilenames = new Set(
      uploadedAssetsList.map((asset) => asset.filename)
    );

    console.log("Source assets count:", assets.items.length);
    console.log("Destination assets count:", uploadedAssetsList.length);
    console.log(
      "First few source filenames:",
      assets.items.slice(0, 3).map((a) => a.filename)
    );
    console.log(
      "First few destination filenames:",
      uploadedAssetsList.slice(0, 3).map((a) => a.filename)
    );

    // Check if all source assets exist in the destination by filename
    const allExist = assets.items.every((asset) => {
      if (!asset?.filename) return false;
      const exists = uploadedFilenames.has(asset.filename);
      if (!exists) {
        console.log(
          `Missing asset filename: ${asset.filename} (ID: ${asset.id})`
        );
      }
      return exists;
    });

    console.log("All assets exist in destination:", allExist);
    return allExist;
  } catch (err) {
    console.log("Error checking uploaded assets:", err);
    if (err.name === "AbortError") {
      console.log("Request timed out - assuming no assets uploaded");
    }
    return false;
  }
};

// Function to get repository languages from Prismic API
export async function getRepositoryLanguages(
  repository,
  isDestination = false
) {
  console.log(
    `Fetching languages for ${repository} (isDestination: ${isDestination})`
  );

  // Try multiple approaches to get repository languages

  // Approach 1: Try public API first (no auth required)
  try {
    const publicUrl = `https://${repository}.cdn.prismic.io/api/v2?_=${Date.now()}`;
    console.log(`Trying public API for ${repository}: ${publicUrl}`);

    const publicResponse = await fetch(publicUrl, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (publicResponse.ok) {
      const publicData = await publicResponse.json();
      console.log(
        `Languages found via public API for ${repository}:`,
        publicData.languages
      );
      return publicData.languages || [];
    } else {
      console.log(
        `Public API failed for ${repository}: ${publicResponse.status}`
      );
    }
  } catch (publicError) {
    console.log(`Public API error for ${repository}:`, publicError.message);
  }

  // Approach 2: Try with authentication
  try {
    let token;
    if (isDestination) {
      // For destination, try write API key first
      try {
        token = await getWriteToken();
        console.log(`Using write API key for ${repository}`);
      } catch (writeError) {
        console.log(
          `Write API key failed, trying auth token for ${repository}`
        );
        token = await getDestinationToken();
      }
    } else {
      token = await getReadToken();
    }

    const authUrl = `https://${repository}.cdn.prismic.io/api/v2?_=${Date.now()}`;
    const authResponse = await fetch(authUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      },
    });

    if (!authResponse.ok) {
      console.error(
        `Authenticated API failed for ${repository}:`,
        authResponse.status,
        authResponse.statusText
      );
      const errorText = await authResponse.text();
      console.error("Auth error response:", errorText);
      return [];
    }

    const authData = await authResponse.json();
    console.log(
      `Languages found via auth API for ${repository}:`,
      authData.languages
    );
    return authData.languages || [];
  } catch (authError) {
    console.error(`Authentication error for ${repository}:`, authError.message);
    return [];
  }
}

// Function to detect languages used in documents
export function detectDocumentLanguages(documents) {
  const languages = new Set();

  documents.forEach((doc) => {
    // Check if document has lang property
    if (doc.lang) {
      languages.add(doc.lang);
    }

    // Check for alternative language properties
    if (doc.language) {
      languages.add(doc.language);
    }

    // Check for language in data structure
    if (doc.data && doc.data.lang) {
      languages.add(doc.data.lang);
    }
  });

  return Array.from(languages);
}

// Normalize filenames to improve matching reliability between repositories
export function normalizeFilename(filename) {
  if (!filename || typeof filename !== "string") return "";
  const withoutDiacritics = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[\s._-]+/g, "-");
}

function getFilenameParts(filename) {
  if (!filename || typeof filename !== "string") {
    return { base: "", ext: "" };
  }
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return { base: filename, ext: "" };
  }
  return {
    base: filename.slice(0, lastDot),
    ext: filename.slice(lastDot + 1).toLowerCase(),
  };
}

// Fetch assets list for a repository via Prismic Asset API
async function fetchAssetsListForRepository(repository, useWriteToken = false) {
  if (!repository) throw new Error("Repository name is required");

  // 10s timeout to avoid hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const token = useWriteToken ? await getWriteToken() : await getReadToken();
    const response = await fetch(
      "https://asset-api.prismic.io/assets?limit=1000",
      {
        method: "GET",
        headers: {
          repository,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.log(
        `Failed to fetch assets for ${repository}: ${response.status} ${response.statusText}`
      );
      if (text) console.log("Error body:", text.substring(0, 300));
      return [];
    }

    const text = await response.text();
    if (!text) return [];
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.log("Failed parsing assets list for", repository, e.message);
      return [];
    }

    // Expected structure: { total, items: [] }
    if (!parsed || !Array.isArray(parsed.items)) return [];

    // Return minimal shape used for mapping
    return parsed.items
      .filter((a) => a && a.id && a.filename)
      .map((a) => ({ id: a.id, filename: a.filename }));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === "AbortError") {
      console.log(`Assets fetch timed out for ${repository}`);
    } else {
      console.log(`Assets fetch error for ${repository}:`, err.message || err);
    }
    return [];
  }
}

// Build a sourceId -> destinationId mapping using normalized filenames
export async function buildAssetIdMappingByFilename() {
  if (!process.env.Source_Repo || !process.env.Destination_Repo) {
    console.log(
      "Source_Repo or Destination_Repo env var missing - cannot build mapping"
    );
    return {
      mappings: [],
      stats: { totalSource: 0, totalDestination: 0, matched: 0, ambiguous: 0 },
    };
  }

  const sourceList = await fetchAssetsListForRepository(
    process.env.Source_Repo,
    false
  );
  const destinationList = await fetchAssetsListForRepository(
    process.env.Destination_Repo,
    true
  );

  const totalSource = sourceList.length;
  const totalDestination = destinationList.length;

  const sourceByName = new Map(); // normBaseName -> [{id, ext, filename}]
  const destByName = new Map(); // normBaseName -> [{id, ext, filename}]

  for (const s of sourceList) {
    const parts = getFilenameParts(s.filename);
    const norm = normalizeFilename(parts.base);
    if (!sourceByName.has(norm)) sourceByName.set(norm, []);
    sourceByName
      .get(norm)
      .push({ id: s.id, ext: parts.ext, filename: s.filename });
  }
  for (const d of destinationList) {
    const parts = getFilenameParts(d.filename);
    const norm = normalizeFilename(parts.base);
    if (!destByName.has(norm)) destByName.set(norm, []);
    destByName
      .get(norm)
      .push({ id: d.id, ext: parts.ext, filename: d.filename });
  }

  const mappings = [];
  let matched = 0;
  let ambiguous = 0;

  for (const [normName, sourceInfos] of sourceByName.entries()) {
    const destInfos = destByName.get(normName) || [];
    if (destInfos.length === 0) continue; // no match by base filename

    for (const sInfo of sourceInfos) {
      let chosen = null;
      // 1) Exact extension match
      chosen = destInfos.find((d) => d.ext === sInfo.ext) || null;
      // 2) Common conversions (jpg/png -> webp)
      if (
        !chosen &&
        (sInfo.ext === "jpg" || sInfo.ext === "jpeg" || sInfo.ext === "png")
      ) {
        chosen = destInfos.find((d) => d.ext === "webp") || null;
      }
      // 3) Fallback: first destination
      if (!chosen && destInfos.length > 0) {
        chosen = destInfos[0];
      }
      if (!chosen) continue;

      mappings.push({ prevID: sInfo.id, id: chosen.id });
      matched += 1;
      if (sourceInfos.length > 1 || destInfos.length > 1) {
        ambiguous += 1;
        console.log(
          `Ambiguous filename match for '${normName}': sources=${sourceInfos.length}, destinations=${destInfos.length}. Using ${sInfo.filename} -> ${chosen.filename}`
        );
      }
    }
  }

  console.log("Asset ID mapping by filename stats:", {
    totalSource,
    totalDestination,
    matched,
    ambiguous,
  });

  // Log a few unmapped source assets to help diagnostics
  if (matched < totalSource) {
    const mappedSourceIds = new Set(mappings.map((m) => m.prevID));
    const samples = [];
    for (const s of sourceList) {
      if (!mappedSourceIds.has(s.id)) {
        const parts = getFilenameParts(s.filename);
        samples.push({
          id: s.id,
          filename: s.filename,
          base: parts.base,
          ext: parts.ext,
        });
        if (samples.length >= 10) break;
      }
    }
    if (samples.length > 0) {
      console.log("Sample of unmapped source assets (first 10):", samples);
    }
  }

  return {
    mappings,
    stats: { totalSource, totalDestination, matched, ambiguous },
  };
}
