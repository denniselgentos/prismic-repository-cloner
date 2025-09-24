import { Box, Button, Text } from "@chakra-ui/react";
import React, { useState, useEffect, useCallback } from "react";

export default function AssetsUploader({
  assets,
  setNewAssets,
  isEnabled,
  setEnabled,
  skipUploadedCheck = false,
}) {
  const [loader, setLoader] = useState(false);
  const [isDone, setDone] = useState(false);
  const [assetsAlreadyUploaded, setAssetsAlreadyUploaded] = useState(false);

  const checkUploadedAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets/check-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets }),
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
        setDone(true);
        setAssetsAlreadyUploaded(true);
        setEnabled((prevState) => {
          return { ...prevState, migrateDocuments: true };
        });
      }
    } catch (err) {
      console.log("Error checking uploaded assets:", err);
      // Don't throw the error to prevent component crashes
    }
  }, [assets, setEnabled]);

  // Check if assets are already uploaded when component mounts or assets change
  // Skip this check if it's already been done by AssetsFetcher
  useEffect(() => {
    if (
      !skipUploadedCheck &&
      assets &&
      assets.items &&
      assets.items.length > 0
    ) {
      checkUploadedAssets();
    }
  }, [assets, checkUploadedAssets, skipUploadedCheck]);

  const downloadAssets = async () => {
    try {
      setLoader(true);
      const res = await fetch("/api/assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets,
        }),
      });
      const ans = await res.json();
      console.log(ans.newAssets);
      if (res.status === 200) {
        setDone(true);
        setNewAssets(ans.newAssets);
        setEnabled((prevState) => {
          return { ...prevState, migrateDocuments: true };
        });
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
      <Button
        onClick={downloadAssets}
        isLoading={loader}
        mb={2}
        isDisabled={!isEnabled.uploadAssets}
      >
        3. Upload assets
      </Button>{" "}
      {isDone && (
        <Text as={"span"} color="green.500">
          {assetsAlreadyUploaded
            ? " All assets are already uploaded and ready for document migration "
            : " All assets have been uploaded successfully "}
        </Text>
      )}
    </Box>
  );
}
