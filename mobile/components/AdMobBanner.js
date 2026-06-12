import React, { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import {
  ADMOB_ANDROID_BANNER_HOME_UNIT_ID,
  ADMOB_IOS_BANNER_HOME_UNIT_ID,
} from "../config";

let adsModule = null;

try {
  adsModule = require("react-native-google-mobile-ads");
} catch {
  adsModule = null;
}

const mobileAds = adsModule?.default || null;
const BannerAd = adsModule?.BannerAd || null;
const BannerAdSize = adsModule?.BannerAdSize || null;
const TestIds = adsModule?.TestIds || null;

let sdkInitStarted = false;

function resolveBannerUnitId() {
  if (__DEV__ && TestIds?.BANNER) {
    return TestIds.BANNER;
  }

  return Platform.select({
    android: ADMOB_ANDROID_BANNER_HOME_UNIT_ID,
    ios: ADMOB_IOS_BANNER_HOME_UNIT_ID,
    default: "",
  });
}

export default function AdMobBanner({ visible, style }) {
  const [failed, setFailed] = useState(false);
  const unitId = useMemo(() => resolveBannerUnitId(), []);

  useEffect(() => {
    if (!visible || !mobileAds || sdkInitStarted) return;
    sdkInitStarted = true;
    mobileAds().initialize().catch(() => {});
  }, [visible]);

  if (!visible || failed || !BannerAd || !BannerAdSize || !unitId) {
    return null;
  }

  return (
    <View style={style}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER || BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
