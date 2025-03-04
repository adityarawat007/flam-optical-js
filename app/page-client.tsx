"use client";

import { useEffect, useRef } from "react";
import App from "../app";
import Banner from "./banner";

const Tracker = ({
  videoUrl,
  bannerData,
  image_url,
  variant_offset,
  variant_scale_axis,
}: {
  videoUrl: string;
  bannerData: {
    title: string;
    sub_title: string;
    redirect_url: string;
    show: boolean;
    primary_color: string;
    secondary_color: string;
  };
  image_url: string;
  variant_offset: any;
  variant_scale_axis: any;
}) => {
  const canvasRef = useRef<any>(null);
  const videoRef = useRef<any>(null);
  const errorRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const app = new App(
          "output-canvas",
          "camera-input",
          "stats-panel",
          "glCanvas",
          image_url,
          videoUrl,
          variant_offset,
          variant_scale_axis
        );

        await app.initialize();
        app.processFrame();

        window.addEventListener("beforeunload", () => app.cleanup());
      } catch (error: any) {
        console.error("Error loading campaign:", error);
        showError(error.message);
      }
    };

    if (videoUrl) fetchData();
  }, [videoUrl]);

  const showError = (message: any) => {
    if (errorRef.current) {
      errorRef.current.textContent = message;
      errorRef.current.classList.remove("hidden");
    }
  };

  useEffect(() => {
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const resizeCanvas = () => {
    if (canvasRef.current && videoRef.current) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      videoRef.current.width = window.innerWidth;
      videoRef.current.height = window.innerHeight;
    }
  };

  return (
    <>
      <div className="content-area h-screen w-screen">
        <div id="canvas-container">
          <canvas id="output-canvas" />
          <canvas id="glCanvas" />
          <div
            ref={errorRef}
            id="error-message"
            className="error-message hidden"
          />
          <div id="stats-panel" className="stats-panel" />
        </div>
      </div>
      <Banner
        title={bannerData.title}
        sub_title={bannerData.sub_title}
        redirect_url={bannerData.redirect_url}
        show={bannerData.show}
        primary_color={bannerData.primary_color}
        secondary_color={bannerData.secondary_color}
      />
      <img
        id="reference-image"
        src="https://storage.googleapis.com/zingcam/original/images/y4x90r1cm4extw0cfzol43nt.jpg"
        alt="Reference"
      />
      <video
        id="camera-input"
        autoPlay
      />
    </>
  );
};

export default Tracker;
