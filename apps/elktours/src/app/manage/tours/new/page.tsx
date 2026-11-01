import { TourForm } from "@/components/manage/tour-form";

export default function NewTourPage() {
  return (
    <>
      <h2 className="font-serif text-2xl">New tour</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Save it first; stops and departures are added on the next screen.
      </p>
      <div className="mt-6">
        <TourForm />
      </div>
    </>
  );
}
