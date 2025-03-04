/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import Tracker from "./tracker";
import { BannerComponent } from "./bannerComponent";

const PageClient = ({ data }: { data: any }) => {
  const [onboarding, setOnboarding] = useState(false);

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

  function OnboardingScreen() {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <Button
          className="font-bold text-xl"
          size="lg"
          onClick={() => setOnboarding(true)}
        >
          Start Experience
        </Button>
      </div>
    );
  }

  return (
    <>
      {" "}
      {!onboarding ? (
        <BannerComponent />
      ) : (
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
