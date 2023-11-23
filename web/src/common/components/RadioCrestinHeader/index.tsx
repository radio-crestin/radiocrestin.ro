import React, { useEffect } from "react";
import {
  Image,
  Flex,
  Text,
} from "@chakra-ui/react";
import Link from "next/link";

export default function RadioCrestinHeader(props: any) {
  return (
      <Link href={'/'}>
        <Flex align="center" my={{base: 6, lg: 8}} mx={{base: 0, lg: 6}}>
          <Image
              loading={"lazy"}
              src={'/images/radiocrestin_logo.png'}
              width={{base: '50px', lg: '40px'}}
              height={'auto'}
              alt={'AppStore Image Radio Crestin'}
          />
          <Text as='h1' fontSize={{base: '2xl', lg: '2xl'}} noOfLines={1} ml={3} fontWeight={600}>
            Radio Crestin
          </Text>
        </Flex>
      </Link>
  )
}