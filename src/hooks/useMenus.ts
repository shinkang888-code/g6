"use client";

import { useState, useEffect } from "react";
import type { MenuItem } from "@/lib/menuConfig";
import { LNB_MENU, MOBILE_MAIN_MENU, MOBILE_MORE_MENU } from "@/lib/menuConfig";

interface MenusState {
  lnb: MenuItem[];
  mobileMain: MenuItem[];
  mobileMore: MenuItem[];
}

const defaultMenus: MenusState = {
  lnb: LNB_MENU,
  mobileMain: MOBILE_MAIN_MENU,
  mobileMore: MOBILE_MORE_MENU,
};

export function useMenus(): MenusState {
  const [menus, setMenus] = useState<MenusState>(defaultMenus);

  useEffect(() => {
    fetch("/api/menus")
      .then((res) => res.json())
      .then((data) => {
        if (data.lnb && Array.isArray(data.lnb)) {
          setMenus({
            lnb: data.lnb,
            mobileMain: Array.isArray(data.mobileMain) ? data.mobileMain : defaultMenus.mobileMain,
            mobileMore: Array.isArray(data.mobileMore) ? data.mobileMore : defaultMenus.mobileMore,
          });
        }
      })
      .catch(() => {});
  }, []);

  return menus;
}
