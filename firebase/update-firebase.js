import { set } from "firebase/database";
import { proxyConfigRef } from "./firebase-config.js";
export const EMPTY_TYPE = {
  EMPTY_ARRAY: "EMPTY_ARRAY",
};
export const saveFirebaseData = async (dataBase, data) => {
  try {
    await set(dataBase, data);
    console.log("proxyFakeDataRef saved");
  } catch (error) {
    console.error("Error saving data to Firebase:", error);
  }
};

saveFirebaseData(proxyConfigRef, {
  fakeData: [
    {
      url: "https://trading.vietcap.com.vn/api/chart/OHLCChart/gap",
      data: EMPTY_TYPE.EMPTY_ARRAY,
    },
  ],
  enableFakeData: false,
});
