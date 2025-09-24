import { Box, Button, Text } from "@chakra-ui/react";
import React, { useState, useEffect, useCallback } from "react";

export default function AssetsFetcher({
  assets,
  setAssets,
  setEnabled,
  onUploadedCheckDone,
}) {
  const [loader, setLoader] = useState(false);
  const [uploadedCheckDone, setUploadedCheckDone] = useState(false);

  const checkUploadedAssets = useCallback(
    async (assetsData) => {
      try {
        const res = await fetch("/api/assets/check-uploaded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assets: assetsData }),
        });

        if (!res.ok) {
          console.log(
            "Error response from check-uploaded API:",
            res.status,
            res.statusText
          );
          return;
        }

        const result = await res.json();

        if (res.status === 200 && result.allUploaded) {
          setUploadedCheckDone(true);
          setEnabled((prevState) => {
            return { ...prevState, migrateDocuments: true };
          });
          // Notify parent component that uploaded check is done
          if (onUploadedCheckDone) {
            onUploadedCheckDone();
          }
        }
      } catch (err) {
        console.log("Error checking uploaded assets:", err);
        // Don't throw the error to prevent component crashes
      }
    },
    [setEnabled, onUploadedCheckDone]
  );

  const getAssets = async () => {
    try {
      setLoader(true);
      const res = await fetch("/api/assets");
      const ans = await res.json();

      if (res.status === 200) {
        const assetsData = JSON.parse(ans.assets);
        console.log(assetsData);
        setAssets(assetsData);
        setEnabled((prevState) => {
          return { ...prevState, downloadAssets: true };
        });

        // Check if assets are already uploaded to destination repository
        checkUploadedAssets(assetsData);
      } else {
        console.log(ans.reason, ans.err);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoader(false);
    }
  };
  return (
    <Box>
      <Button onClick={getAssets} isLoading={loader} mb={2}>
        1. Get assets list
      </Button>{" "}
      {assets?.total && (
        <Text as={"span"}>
          {" "}
          {assets?.items.length}/{assets?.total} assets found.{" "}
        </Text>
      )}
    </Box>
  );
}
