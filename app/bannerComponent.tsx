"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import instantBanner from "@/public/instantBanner.jpg";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export const BannerComponent = ({
  setOnboading,
}: {
  setOnboading: (value: boolean) => void;
}) => {
  return (
    <Sheet open={true}>
      <SheetContent
        side="bottom"
        className=" border-0 max-w-3xl my-2 mx-auto select-none bg-transparent backdrop-blur-3xl rounded-4xl w-full "
      >
        <SheetHeader className="border-0 px-2">
          <SheetTitle className="w-full">
            <Image
              src={instantBanner}
              layout="responsive"
              width={600}
              height={475}
              className=" h-full object-cover rounded-t-4xl"
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
