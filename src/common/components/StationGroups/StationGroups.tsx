import { Box, Button, Flex } from '@chakra-ui/react';
import Link from 'next/link';
import React from 'react';
import { IStation } from "@/models/Station";
import { IStationGroup } from "@/models/StationGroup";

export default function StationGroups({
  stationGroups,
  selectedStationGroup,
  selectedStation,
}: {
  stationGroups: IStationGroup[];
  selectedStationGroup: IStationGroup;
  selectedStation: IStation;
}) {
  const selectedStationSlug = selectedStation?.slug || '';

  return (
    <Flex
      ml={2}
      mt={6}
      mb={9}
      mx={{ base: -4, lg: 0 }}
      alignItems="center"
      gap="2"
      style={{ overflow: 'auto' }}
      px={{ base: 2, lg: 0 }}
      pb={{ base: 3, lg: 0 }}>
      {stationGroups.map(stationGroup => (
        <Box key={stationGroup.slug}>
          <Link
            prefetch={false}
            href={`/${encodeURIComponent(
              stationGroup?.slug,
            )}/${encodeURIComponent(selectedStationSlug)}`}
            scroll={false}>
            <Button
              key={stationGroup.slug}
              isActive={stationGroup.slug === selectedStationGroup.slug}
              style={{ margin: '3px' }}>
              {stationGroup.name}
            </Button>
          </Link>
        </Box>
      ))}
    </Flex>
  );
}
