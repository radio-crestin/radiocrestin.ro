import React, { useEffect } from "react";
import { useRouter } from "next/router";

import styles from "./styles.module.scss";
import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  Image,
  ModalOverlay,
  Text,
  useDisclosure,
  Heading,
} from "@chakra-ui/react";
import Link from "next/link";
import useDeviceType from "@/hooks/useDeviceType";
import RadioCrestinHeader from "@/components/RadioCrestinHeader";

export default function OpenMobileApp(props: any) {
  const deviceType = useDeviceType();
  const { isOpen, onOpen, onClose } = useDisclosure()
  const router = useRouter();
  const { nfc_tag } = router.query;
  useEffect(() => {
    if(nfc_tag && deviceType != 'desktop') {
      onOpen();
    }
  }, [nfc_tag, deviceType]);
  return (
      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody px={6}>
            <RadioCrestinHeader/>
            <Heading mt={32} size={'xl'}>
              Vă rugam să instalați aplicația mobilă.
            </Heading>
            <Box mt={16} display={'flex'} gap={2} alignItems={'center'} w={'100%'}>
              {(deviceType == 'desktop' || deviceType == 'ios') && <Box w={'100%'}>
                <Link href="https://apps.apple.com/app/6451270471" target={"_blank"}>
                  <Image
                      loading={"lazy"}
                      src={'/images/appstore.svg'}
                      width={'100%'}
                      maxWidth={'250px'}
                      height={'auto'}
                      alt={'AppStore Image Radio Crestin'}
                  />
                </Link>
              </Box>}
              {(deviceType == 'desktop' || deviceType == 'android') && <Box w={'100%'}>
                <Link
                    href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&hl=en_US"
                    style={{ position: 'relative' }} target={"_blank"}>
                  <Image
                      loading={"lazy"}
                      className={styles.playstore_link}
                      src={'/images/playstore.svg'}
                      width={'100%'}
                      maxWidth={'250px'}
                      height={'auto'}
                      alt={'PlayStore Image Radio Crestin'}
                  />
                </Link>
              </Box>}
              {(deviceType == 'desktop' || deviceType == 'huawei') && <Box w={'100%'}>
                <Link
                    href="https://appgallery.huawei.com/app/C109055331"
                    style={{ position: 'relative' }} target={"_blank"}>
                  <Image
                      loading={"lazy"}
                      className={styles.playstore_link}
                      src={'/images/appgallery.svg'}
                      width={'100%'}
                      maxWidth={'250px'}
                      height={'auto'}
                      alt={'AppGallery Image Radio Crestin'}
                  />
                </Link>
              </Box>}
            </Box>
          </ModalBody>

          <ModalFooter>
            <Button variant='ghost' onClick={onClose} fontSize={'xl'}>Nu mulțumesc</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
  )
}