import React from "react";
import Link from 'next/link';

import { Box, Text } from '@chakra-ui/react';
import styles from './DownloadAppBanner.module.scss';
import useDeviceType from "@/hooks/useDeviceType";

export default function DownloadAppBanner() {
  const deviceType = useDeviceType();

  return (
    <Box
      mt={150}
      mb={20}
      pt={{ base: 50, md: 100 }}
      display={'flex'}
      flexDirection={{ base: 'column', md: 'row' }}
      background={'#c6eaff'}
      position={'relative'}
      justifyContent={'space-between'}>
      <Box
        minW={{ md: '390px', lg: '625px' }}
        paddingLeft={{ base: '20px', md: '60px' }}
        paddingRight={{ base: '20px', md: '0' }}
        paddingBottom={20}>
        <Text fontSize={32} fontWeight={700} letterSpacing={0.7}>
          Descarcă aplicația Radio Creștin
        </Text>
        <Text fontSize={15}>
          Toate posturile tale preferate într-un singur loc, gratis și fără
          reclame.
        </Text>
        <Box mt={5} display={'flex'} gap={2} alignItems={'center'} w={'100%'} maxWidth={450}>
          {(deviceType == 'desktop' || deviceType == 'ios') && <Box width={deviceType == 'desktop' ? '33%': '48%'}>
            <Link href="https://apps.apple.com/app/6451270471" target={"_blank"}>
              <img
                loading={"lazy"}
                src={'/images/appstore.svg'}
                width={'100%'}
                height={'auto'}
                alt={'AppStore Image Radio Crestin'}
              />
            </Link>
          </Box>}
          {(deviceType == 'desktop' || deviceType == 'android') && <Box width={deviceType == 'desktop' ? '33%': '48%'}>
            <Link
              href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&hl=en_US"
              style={{ position: 'relative' }} target={"_blank"}>
              <img
                loading={"lazy"}
                className={styles.playstore_link}
                src={'/images/playstore.svg'}
                width={'100%'}
                height={'auto'}
                alt={'PlayStore Image Radio Crestin'}
              />
            </Link>
          </Box>}
          {(deviceType == 'desktop' || deviceType == 'huawei') && <Box width={deviceType == 'desktop' ? '33%': '48%'}>
            <Link
              href="https://appgallery.huawei.com/app/C109055331"
              style={{ position: 'relative' }} target={"_blank"}>
              <img
                loading={"lazy"}
                className={styles.playstore_link}
                src={'/images/appgallery.svg'}
                width={'100%'}
                height={'auto'}
                alt={'AppGallery Image Radio Crestin'}
              />
            </Link>
          </Box>}
        </Box>
      </Box>
      <Box
        position={'relative'}
        width={{ base: '100%', lg: '500px' }}
        marginRight={{ base: 0, lg: 90, xl: 150 }}>
        <img
          loading={"lazy"}
          className={styles.image_iphone12}
          width={500}
          height={500}
          src={'/images/iphone12-mock.png'}
          alt={'iPhone 12 Radio Crestin'}
        />
        <img
          loading={"lazy"}
          className={styles.image_iphone12_mobile}
          width={400}
          height={400}
          src={'/images/iphone12_mobile.png'}
          alt={'iPhone 12 Radio Crestin'}
        />
      </Box>
      <img
        loading={"lazy"}
        className={styles.image_qr_code}
        width={90}
        height={90}
        src={'/images/qr-code.png'}
        alt={'QR Code Radio Crestin'}
      />
    </Box>
  );
}
