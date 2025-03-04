/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import PageClient from "./page-client";

export default async function PreviewPage(props: {
  searchParams: Promise<{ o: string }>;
}) {
  const { o } = await props.searchParams;

  if (!o) {
    notFound();
  }

  const res = await fetch(
    `https://zingcam.prod.flamapp.com/campaign-svc/api/v1/campaigns/${o}/experiences`
  );
  const responseData = await res.json();

  if (responseData.status !== 200) {
    notFound();
  }

  if (!responseData) {
    return null;
  }

  return (
    <>
      <PageClient data={responseData} />
    </>
  );
}
