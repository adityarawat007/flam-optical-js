/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

"use client";

import { useEffect, useRef, useState } from "react";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Detect if on mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      setIsMobile(mobile);
    };

    checkMobile();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const app = new App(
          "output-canvas",
          "camera-input",
          "reference-image",
          "glCanvas",
          image_url,
          videoUrl,
          variant_offset,
          variant_scale_axis
        );

        await app.initialize();
        app.processFrame();

        window.addEventListener("beforeunload", () => app.cleanup());

        return () => {
          app.cleanup();
          window.removeEventListener("beforeunload", () => app.cleanup());
        };
      } catch (error: any) {
        console.error("Error loading campaign:", error);
        showError(error.message);
      }
    };

    if (videoUrl) fetchData();
  }, [videoUrl]);

  const showError = (message: string) => {
    if (errorRef.current) {
      errorRef.current.textContent = message;
      errorRef.current.classList.remove("hidden");
    }
  };

  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
    };

    const handleOrientationChange = () => {
      // Small delay to allow the browser to complete the orientation change
      setTimeout(resizeCanvas, 300);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    // Initial setup
    resizeCanvas();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  const resizeCanvas = () => {
    if (canvasRef.current && videoRef.current && glCanvasRef.current) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      // Update canvas dimensions
      canvasRef.current.width = screenWidth;
      canvasRef.current.height = screenHeight;

      // Update GL canvas dimensions
      glCanvasRef.current.width = screenWidth;
      glCanvasRef.current.height = screenHeight;

      // Update video element dimensions to match
      videoRef.current.width = screenWidth;
      videoRef.current.height = screenHeight;

      // Add specific styling for the GL canvas
      const glCanvas = glCanvasRef.current;
      glCanvas.style.width = "100%";
      glCanvas.style.height = "100%";
      glCanvas.style.position = "absolute";
      glCanvas.style.top = "0";
      glCanvas.style.left = "0";
      glCanvas.style.zIndex = "5";

      // Adjust canvas container for better mobile display
      const container = document.getElementById("canvas-container");
      if (container) {
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.overflow = "hidden";

        // Force the container to be full viewport on mobile
        if (isMobile) {
          container.style.position = "fixed";
          container.style.top = "0";
          container.style.left = "0";
          container.style.right = "0";
          container.style.bottom = "0";
        }
      }
    }
  };

  return (
    <>
      <div className="content-area h-screen w-screen">
        <div id="canvas-container" className="w-full h-full fixed top-0 left-0">
          <canvas
            ref={canvasRef}
            id="output-canvas"
            className="w-full h-full"
          />
          <canvas
            ref={glCanvasRef}
            id="glCanvas"
            className="w-full h-full absolute top-0 left-0 z-5"
          />
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
        src={image_url}
        alt="Reference"
        className="hidden"
      />
      <video
        ref={videoRef}
        id="camera-input"
        autoPlay
        playsInline
        muted
        className="absolute opacity-0 pointer-events-none"
      />
    </>
  );
};

export default Tracker;
