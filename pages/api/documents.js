import * as prismic from "@prismicio/client";

import {
  getToken,
  getRepositoryLanguages,
  detectDocumentLanguages,
  getDestinationToken,
  buildAssetIdMappingByFilename,
} from "@/lib/assets";

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export default async function handler(req, res) {
  switch (req.method) {
    case "POST":
      const { newAssets } = req.body;

      const token = await getToken();
      //Get all shared slices
      const slicesRes = await fetch("https://customtypes.prismic.io/slices", {
        headers: {
          repository: process.env.Source_Repo,
          Authorization: `Bearer ${token}`,
        },
      });
      const slices = await slicesRes.json();

      //Migrate all slices
      for (let i = 0; i < slices.length; i++) {
        await fetch("https://customtypes.prismic.io/slices/insert", {
          method: "POST",
          headers: {
            repository: process.env.Destination_Repo,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(slices[i]),
        });
      }
      //return res.status(200).json({ ok: true });
      //Get all types
      const typesRes = await fetch(
        "https://customtypes.prismic.io/customtypes",
        {
          headers: {
            repository: process.env.Source_Repo,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const types = await typesRes.json();

      // migrate all types
      for (let i = 0; i < types.length; i++) {
        await fetch("https://customtypes.prismic.io/customtypes/insert", {
          method: "POST",
          headers: {
            repository: process.env.Destination_Repo,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(types[i]),
        });
      }

      //Get all documents
      const client = prismic.createClient(process.env.Source_Repo, {});
      let allDocuments = await client.dangerouslyGetAll();
      let failures = 0;

      // Check languages before migration
      console.log("Checking repository languages...");
      const sourceLanguages = await getRepositoryLanguages(
        process.env.Source_Repo,
        false
      );
      const destinationLanguages = await getRepositoryLanguages(
        process.env.Destination_Repo,
        true
      );
      const documentLanguages = detectDocumentLanguages(allDocuments);

      console.log(
        "Source languages:",
        sourceLanguages.map((l) => l.id)
      );
      console.log(
        "Destination languages:",
        destinationLanguages.map((l) => l.id)
      );
      console.log("Document languages:", documentLanguages);

      const missingLanguages = documentLanguages.filter(
        (lang) => !destinationLanguages.some((destLang) => destLang.id === lang)
      );

      if (missingLanguages.length > 0) {
        console.log(
          "⚠️  WARNING: Missing languages in destination repository:",
          missingLanguages
        );
        console.log(
          "Please add these languages to your destination repository:"
        );
        console.log(
          "1. Go to Prismic dashboard > Settings > Translations & Locales"
        );
        console.log(
          "2. Add the following languages:",
          missingLanguages.join(", ")
        );
        console.log("3. Save and retry migration");
      }

      // If no mappings were provided from the upload step, build them by filename
      let effectiveMappings = Array.isArray(newAssets) ? [...newAssets] : [];
      if (!effectiveMappings || effectiveMappings.length === 0) {
        console.log("No newAssets provided - building mapping by filename...");
        try {
          const { mappings, stats } = await buildAssetIdMappingByFilename();
          effectiveMappings = mappings;
          console.log(
            `Built ${mappings.length} filename-based mappings (source assets: ${stats.totalSource}, destination assets: ${stats.totalDestination}, ambiguous: ${stats.ambiguous})`
          );
        } catch (e) {
          console.log("Failed to build filename-based mapping:", e.message);
        }
      }

      //Migrate documents
      console.log(
        `Starting migration of ${allDocuments.length} documents with ${effectiveMappings.length} asset mappings`
      );

      if (!effectiveMappings || effectiveMappings.length === 0) {
        console.log(
          "WARNING: No asset mappings available. Asset IDs will not be replaced!"
        );
      }

      for (let i = 0; i < allDocuments.length; i++) {
        let document = JSON.stringify(allDocuments[i]);

        // Safely extract document name with proper error handling
        let documentName = `document ${i}`;
        try {
          if (
            allDocuments[i].data &&
            allDocuments[i].data.title &&
            Array.isArray(allDocuments[i].data.title) &&
            allDocuments[i].data.title.length > 0 &&
            allDocuments[i].data.title[0] &&
            allDocuments[i].data.title[0].text
          ) {
            documentName = allDocuments[i].data.title[0].text;
          }
        } catch (err) {
          console.log(
            `Could not extract title for document ${i}:`,
            err.message
          );
        }

        //Update assets id with new one - do this on the JSON string first
        let assetReplacements = 0;
        for (let j = 0; j < effectiveMappings.length; j++) {
          const beforeReplace = document;
          document = document.replaceAll(
            effectiveMappings[j].prevID,
            effectiveMappings[j].id
          );
          if (beforeReplace !== document) {
            assetReplacements++;
            if (i < 3) {
              // Log for first few documents
              console.log(
                `Replaced asset ID ${effectiveMappings[j].prevID} with ${effectiveMappings[j].id} in document ${i}`
              );
            }
          }
        }
        if (i < 3) {
          console.log(
            `Document ${i}: Made ${assetReplacements} asset ID replacements`
          );
        }

        try {
          // Parse and validate the document data
          let documentData;
          try {
            documentData = JSON.parse(document);
          } catch (parseErr) {
            console.log(
              `Failed to parse document ${i} (${documentName}):`,
              parseErr.message
            );
            failures++;
            continue;
          }

          // Validate required fields
          if (!documentData.id || !documentData.type) {
            console.log(
              `Document ${i} (${documentName}) missing required fields (id or type)`
            );
            failures++;
            continue;
          }

          // Additional asset ID replacement on the parsed object
          // This catches asset IDs in nested structures that might have been missed
          const replaceAssetIdsInObject = (obj) => {
            if (typeof obj === "string") {
              for (let j = 0; j < effectiveMappings.length; j++) {
                obj = obj.replaceAll(
                  effectiveMappings[j].prevID,
                  effectiveMappings[j].id
                );
              }
              return obj;
            } else if (Array.isArray(obj)) {
              return obj.map(replaceAssetIdsInObject);
            } else if (obj && typeof obj === "object") {
              const newObj = {};
              for (const key in obj) {
                newObj[key] = replaceAssetIdsInObject(obj[key]);
              }
              return newObj;
            }
            return obj;
          };

          // Apply asset ID replacement to the entire document data
          const processedDocumentData = replaceAssetIdsInObject(documentData);

          // Prepare the migration payload
          const migrationPayload = {
            ...processedDocumentData,
            title: documentName,
          };

          // Log the payload structure for debugging (first few documents only)
          if (i < 3) {
            console.log(`Document ${i} (${documentName}) payload structure:`, {
              id: migrationPayload.id,
              type: migrationPayload.type,
              title: migrationPayload.title,
              hasData: !!migrationPayload.data,
              dataKeys: migrationPayload.data
                ? Object.keys(migrationPayload.data)
                : [],
            });
          }

          const r = await fetch("https://migration.prismic.io/documents", {
            method: "POST",
            headers: {
              repository: process.env.Destination_Repo,
              "x-api-key": process.env.Migration_Api_Key,
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(migrationPayload),
          });

          if (!r.ok) {
            // Log response body for 400 errors to help debug
            if (r.status === 400) {
              const errorBody = await r.text();
              console.log(
                `400 Error details for document ${i} (${documentName}):`,
                errorBody
              );

              // Check for language-specific errors
              if (errorBody.includes("language you provided is invalid")) {
                console.log(
                  `❌ Language error for document ${i}: The document uses a language that doesn't exist in the destination repository.`
                );
                console.log(
                  `   Document language: ${documentData.lang || "unknown"}`
                );
                console.log(
                  `   Available destination languages: ${destinationLanguages
                    .map((l) => l.id)
                    .join(", ")}`
                );
              }
            }

            if (r.status === 429) {
              // Rate limited - wait longer before continuing
              console.log(
                `Rate limited for document ${i} (${documentName}) - waiting 10 seconds...`
              );
              await delay(10000);
              // Retry once
              const retryResponse = await fetch(
                "https://migration.prismic.io/documents",
                {
                  method: "POST",
                  headers: {
                    repository: process.env.Destination_Repo,
                    "x-api-key": process.env.Migration_Api_Key,
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(migrationPayload),
                }
              );

              if (!retryResponse.ok) {
                console.log(
                  `Retry failed for document ${i} (${documentName}): ${retryResponse.status} ${retryResponse.statusText}`
                );
                failures++;
                continue;
              }

              const retryAns = await retryResponse.text();
              console.log(
                `Successfully migrated document ${i} (${documentName}) on retry:`,
                retryAns
              );

              if (retryAns.search(`"id":`) === -1) {
                console.log(
                  `Document ${i} (${documentName}) migration failed on retry - no ID in response`
                );
                failures++;
              }
            } else {
              console.log(
                `Failed to migrate document ${i} (${documentName}): ${r.status} ${r.statusText}`
              );
              failures++;
              continue;
            }
          } else {
            const ans = await r.text();
            console.log(`Migrated document ${i} (${documentName}):`, ans);

            //Number of failures
            if (ans.search(`"id":`) === -1) {
              console.log(
                `Document ${i} (${documentName}) migration failed - no ID in response`
              );
              failures++;
            }
          }
        } catch (err) {
          console.log(
            `Error migrating document ${i} (${documentName}):`,
            err.message
          );
          failures++;
        }

        // Increased delay to avoid rate limiting (429 errors)
        await delay(3000);
      }

      return res
        .status(200)
        .json({ done: true, nbrDocs: allDocuments.length, failures });
    default:
      return res.status(500).json({ reason: "Not allowed" });
  }
}
