import { Box, Button, Text } from "@chakra-ui/react";
import React, { useState, useEffect, useCallback } from "react";

export default function AssetsDownloader({ assets, isEnabled, setEnabled }) {
  const [loader, setLoader] = useState(false);
  const [isDone, setDone] = useState(false);
  const [assetsAlreadyExist, setAssetsAlreadyExist] = useState(false);

  const checkExistingAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/assets/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets }),
      });
      const result = await res.json();

      if (res.status === 200 && result.allExist) {
        setDone(true);
        setAssetsAlreadyExist(true);
        setEnabled((prevState) => {
          return { ...prevState, uploadAssets: true };
        });
      }
    } catch (err) {
      console.log("Error checking existing assets:", err);
    }
  }, [assets, setEnabled]);

  // Check if assets already exist when component mounts or assets change
  useEffect(() => {
    if (assets && assets.items && assets.items.length > 0) {
      checkExistingAssets();
    }
  }, [assets, checkExistingAssets]);
  const downloadAssets = async () => {
    try {
      setLoader(true);
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets,
        }),
      });
      const ans = await res.json();
      console.log(ans);
      if (res.status === 200) {
        setDone(true);
        setAssetsAlreadyExist(false);
        setEnabled((prevState) => {
          return { ...prevState, uploadAssets: true };
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
        isDisabled={!isEnabled.downloadAssets}
      >
        2. Download assets
      </Button>{" "}
      {isDone && (
        <Text as={"span"} color="green.500">
          {assetsAlreadyExist
            ? " All assets already exist and are ready for upload "
            : " All assets have been downloaded successfully "}
        </Text>
      )}
    </Box>
  );
}
