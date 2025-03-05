/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

"use client";

import { useState } from "react";
import Tracker from "./tracker";
import { BannerComponent } from "./bannerComponent";
import { Button } from "@/components/ui/button";

const PageClient = ({ data }: { data: any }) => {
  const [onboarding, setOnboarding] = useState(false);
  const [showBanner, setShowBanner] = useState(true);


  const experience = data?.data?.experiences[0];

  const videoUrl = experience?.videos?.compressed;
  const imageUrl = experience?.images?.compressed;

  const bannerData = {
    title: experience?.ui_elements?.banners?.title,
    sub_title: experience?.ui_elements?.banners?.sub_title,
    redirect_url: experience?.ui_elements?.banners?.redirection_url,
    show:
      !experience?.ui_elements?.banners ||
      experience?.ui_elements?.banners?.variant !== 0,
    primary_color: experience?.ui_elements?.banners?.primary_color,
    secondary_color: experience?.ui_elements?.banners?.secondary_color,
  };

  //Onboading Section
  const WelcomeSetion = () => {
    return (
      <div className="w-full bg-lime-300 h-full flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <h2 className="text-2xl font-bold">
            Welcome To{" "}
            <span className="italic bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-pink-400">
              Flam
            </span>{" "}
            Experience
          </h2>
          <Button
            className="text-xl rounded-xl p-6 font-medium "
            onClick={() => setShowBanner(true)}
          >
            Ready, Set Go!
          </Button>
        </div>
        
        {/* Bottom Sheet */}
        <BannerComponent
          setShowBanner={setShowBanner}
          showBanner={showBanner}
          setOnboading={setOnboarding}
        />
      </div>
    );
  };

  return (
    <>
      {" "}
      {!onboarding ? (
        <WelcomeSetion />
      ) : (

        // Tracker Component
        <Tracker
          videoUrl={videoUrl}
          bannerData={bannerData}
          image_url={imageUrl}
          variant_offset={experience?.variant?.offset}
          variant_scale_axis={experience?.variant?.scale_axis}
        />
      )}
    </>
  );
};

export default PageClient;
