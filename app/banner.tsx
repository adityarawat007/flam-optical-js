import { CornerUpRight } from "lucide-react";
import Link from "next/link";

export default function Banner({
  title = "Register now",
  sub_title = "Get 10% discount",
  redirect_url = "/",
  show = true,
  primary_color = "#CCFF00",
  secondary_color = "#000000",
}: {
  title?: string;
  sub_title?: string;
  redirect_url?: string;
  show: boolean;
  primary_color?: string;
  secondary_color?: string;
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="absolute bottom-0 z-20 left-0 w-full p-4 flex justify-center items-center">
      <div
        className="right-0 w-full p-4 shadow-lg flex justify-between rounded-xl items-center"
        style={{ backgroundColor: secondary_color }}
      >
        <div className="flex flex-col gap-0 items-start w-4/5 justify-center">
          <p
            className="text-lg font-bold truncate w-full"
            style={{ color: primary_color }}
          >
            {title}
          </p>
          <p
            className="text-sm truncate w-full"
            style={{ color: primary_color }}
          >
            {sub_title}
          </p>
        </div>
        <Link href={redirect_url}>
          <button
            className="p-2 rounded-full"
            style={{ backgroundColor: primary_color }}
          >
            <CornerUpRight
              className="h-5 w-5"
              style={{ color: secondary_color }}
            />
          </button>
        </Link>
      </div>
    </div>
  );
}
