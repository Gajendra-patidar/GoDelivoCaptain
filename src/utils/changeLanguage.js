import AsyncStorage from "@react-native-async-storage/async-storage";
import i18next from "i18next";

export const changeLanguage = (lang) => {
  i18next.changeLanguage(lang);
  AsyncStorage.setItem('user-language', lang);
};