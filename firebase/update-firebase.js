import { saveFirebaseData } from "./firebase-config.js";

saveFirebaseData(proxyConfigRef, {
  fakeData: [
    {
      url: "https://trading.vietcap.com.vn/api/chart/OHLCChart/gap",
      data: EMPTY_TYPE.EMPTY_ARRAY,
    },
  ],
  enableFakeData: false,
});
