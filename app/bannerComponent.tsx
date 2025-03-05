/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import instantBanner from "@/public/instantBanner.jpg";
import Image from "next/image";

export const BannerComponent = ({
  setOnboading,
  showBanner,
  setShowBanner,
}: {
  showBanner: boolean;
  setOnboading: (value: boolean) => void;
  setShowBanner: (value: boolean) => void;
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sheetRef.current &&
        !sheetRef.current.contains(event.target as Node)
      ) {
        setIsClosing(true);
        setTimeout(() => {
          setShowBanner(false);
          setIsClosing(false);
        }, 300);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sheetRef, setShowBanner]);

  return (
    <Sheet open={showBanner}>
      <SheetContent
        ref={sheetRef}
        side="bottom"
        className={` border-0 max-w-3xl my-2 mx-auto bg-black select-none rounded-4xl w-full ${
          isClosing ? "translate-y-full" : "translate-y-0"
        } `}
      >
        <SheetHeader className="border-0 px-2 p-0">
          <SheetTitle className="w-full">
            <Image
              src={instantBanner}
              layout="responsive"
              width={600}
              height={475}
              className="h-full object-cover rounded-t-4xl"
              alt="Instant Banner"
            />
          </SheetTitle>
          <div className="flex justify-between p-4 gap-4 items-center ">
            <div className="flex flex-col">
              <h3 className="text-white text-2xl font-bold">Ready To Play?</h3>
              <p className="text-white text-sm">
                Unlock the next level experience
              </p>
            </div>
            <Button
              size={"lg"}
              onClick={() => setOnboading(true)}
              className="bg-[#1784FF] px-9 py-3 text-lg font-medium rounded-4xl text-white"
            >
              Play
            </Button>
          </div>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};
