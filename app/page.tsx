"use client";

import { notFound, useSearchParams } from "next/navigation";
import PageClient from "./page-client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PreviewPage() {
  const searchParams = useSearchParams();
  const o = searchParams.get("o");

  const [onboarding, setOnboarding] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!o) {
      notFound();
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(
          `https://zingcam.prod.flamapp.com/campaign-svc/api/v1/campaigns/${o}/experiences`
        );
        const responseData = await res.json();

        if (responseData.status !== 200) {
          notFound();
          return;
        }

        setData(responseData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [o]);


  if (!data) {
    return null;
  }

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
      {!onboarding ? (
        <OnboardingScreen />
      ) : (
        <PageClient
          videoUrl={videoUrl}
          bannerData={bannerData}
          image_url={imageUrl}
          variant_offset={experience?.variant?.offset}
          variant_scale_axis={experience?.variant?.scale_axis}
        />
      )}
    </>
  );
}
