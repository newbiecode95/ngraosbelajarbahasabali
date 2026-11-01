import { BaliJourney } from "@/components/entry-journey";
export default function LoadingVillage() {
  return (
    <div className="village-loading" role="status">
      <BaliJourney waiting />
    </div>
  );
}
