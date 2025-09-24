import { Container, Heading } from "@chakra-ui/react";

import { useState, useEffect } from "react";

import AssetsFetcher from "@/components/AssetsFetcher";
import AssetsDownloader from "@/components/AssetsDownloader";
import AssetsUploader from "@/components/AssetsUploader";
import DocumentsMigrator from "@/components/DocumentsMigrator";
import LanguageChecker from "@/components/LanguageChecker";

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [newAssets, setNewAssets] = useState([]);
  const [isEnabled, setEnabled] = useState({});
  const [uploadedCheckDone, setUploadedCheckDone] = useState(false);

  // Load state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem("prismic-migration-state");
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setEnabled(parsedState);
      } catch (err) {
        console.log("Error loading saved state:", err);
      }
    }
  }, []);

  // Save state to localStorage whenever isEnabled changes
  useEffect(() => {
    localStorage.setItem("prismic-migration-state", JSON.stringify(isEnabled));
  }, [isEnabled]);

  return (
    <Container maxW={"5xl"}>
      <Heading textAlign={"center"}>Prismic Migration Tool</Heading>
      <AssetsFetcher
        assets={assets}
        setAssets={setAssets}
        setEnabled={setEnabled}
        onUploadedCheckDone={() => setUploadedCheckDone(true)}
      />
      <AssetsDownloader
        assets={assets}
        isEnabled={isEnabled}
        setEnabled={setEnabled}
      />
      <AssetsUploader
        assets={assets}
        setNewAssets={setNewAssets}
        isEnabled={isEnabled}
        setEnabled={setEnabled}
        skipUploadedCheck={uploadedCheckDone}
      />
      <DocumentsMigrator newAssets={newAssets} isEnabled={isEnabled} />
      <LanguageChecker isEnabled={isEnabled} />
    </Container>
  );
}
