import { useState, useCallback } from "react";
import {
  Box,
  Button,
  VStack,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  List,
  ListItem,
  ListIcon,
  Divider,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { CheckIcon, WarningIcon, InfoIcon } from "@chakra-ui/icons";

export default function LanguageChecker({ isEnabled }) {
  const [languageInfo, setLanguageInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const checkLanguages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/languages");
      const data = await response.json();

      if (response.ok) {
        setLanguageInfo(data);
        toast({
          title: "Language check completed",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(data.error || "Failed to check languages");
      }
    } catch (error) {
      console.error("Error checking languages:", error);
      toast({
        title: "Error checking languages",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  if (!isEnabled.migrateDocuments) {
    return null;
  }

  return (
    <Box p={4} borderWidth={1} borderRadius="md" bg="gray.50">
      <VStack spacing={4} align="stretch">
        <Box>
          <Text fontSize="lg" fontWeight="bold" mb={2}>
            Language Configuration Check
          </Text>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Check if all required languages are configured in the destination
            repository
          </Text>
          <Button
            onClick={checkLanguages}
            isLoading={isLoading}
            loadingText="Checking languages..."
            colorScheme="blue"
            size="sm"
          >
            Check Languages
          </Button>
        </Box>

        {languageInfo && (
          <Box>
            <Divider mb={4} />

            {/* Source Languages */}
            <Box mb={4}>
              <Text fontWeight="bold" mb={2}>
                Source Repository Languages:
              </Text>
              <List spacing={1}>
                {languageInfo.sourceLanguages.map((lang) => (
                  <ListItem key={lang.id} fontSize="sm">
                    <ListIcon as={InfoIcon} color="blue.500" />
                    {lang.name} ({lang.id})
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* Destination Languages */}
            <Box mb={4}>
              <Text fontWeight="bold" mb={2}>
                Destination Repository Languages:
              </Text>
              <List spacing={1}>
                {languageInfo.destinationLanguages.map((lang) => (
                  <ListItem key={lang.id} fontSize="sm">
                    <ListIcon as={CheckIcon} color="green.500" />
                    {lang.name} ({lang.id})
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* Missing Languages Alert */}
            {languageInfo.missingLanguages.length > 0 ? (
              <Alert status="warning" mb={4}>
                <AlertIcon />
                <Box>
                  <AlertTitle>Missing Languages!</AlertTitle>
                  <AlertDescription>
                    The following languages are used in your documents but not
                    configured in the destination repository:
                    <List mt={2} spacing={1}>
                      {languageInfo.missingLanguages.map((lang) => (
                        <ListItem key={lang} fontSize="sm">
                          <ListIcon as={WarningIcon} color="orange.500" />
                          {lang}
                        </ListItem>
                      ))}
                    </List>
                  </AlertDescription>
                </Box>
              </Alert>
            ) : (
              <Alert status="success" mb={4}>
                <AlertIcon />
                <AlertTitle>All languages are configured!</AlertTitle>
                <AlertDescription>
                  The destination repository has all the languages needed for
                  migration.
                </AlertDescription>
              </Alert>
            )}

            {/* Instructions */}
            <Box>
              <Text fontWeight="bold" mb={2}>
                Instructions:
              </Text>
              <List spacing={1}>
                {languageInfo.instructions.map((instruction, index) => (
                  <ListItem key={index} fontSize="sm">
                    {instruction}
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
