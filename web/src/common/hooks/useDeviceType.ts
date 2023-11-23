import { useEffect, useState } from 'react';

const useDeviceType = () => {
  const [deviceType, setDeviceType] = useState('desktop');

  useEffect(() => {
    // Check if we are on the client side
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent;

      if (/android/i.test(userAgent)) {
        setDeviceType('android');
      } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any)['MSStream']) {
        setDeviceType('ios');
      } else if (/huawei/i.test(userAgent)) {
        setDeviceType('huawei');
      } else {
        setDeviceType('desktop');
      }
    }
  }, []);

  return deviceType;
};

export default useDeviceType;