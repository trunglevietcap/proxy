import { set } from "firebase/database";
import { proxyConfigRef } from "./firebase-config.js";
import { EMPTY_TYPE } from "./../proxy.js";

export const saveFirebaseData = async () => {
  try {
    await set(proxyConfigRef, {
      fakeData: [
        {
          url: "https://trading.vietcap.com.vn/api/chart/OHLCChart/gap",
          data: EMPTY_TYPE.EMPTY_ARRAY,
        },
      ],
      enableFakeData: false,
    });
    console.log("proxyFakeDataRef saved");
  } catch (error) {
    console.error("Error saving data to Firebase:", error);
  }
};

saveFirebaseData();
