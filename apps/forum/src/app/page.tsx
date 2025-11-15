export default async function ForumPage() {
  return (
    <main className="w-full">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Community Forum</h1>
          <p className="text-base md:text-lg">
            Discussions and gatherings across the Elkdonis network
          </p>
        </div>

        <div className="text-center py-16 px-4">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="text-2xl font-semibold mb-2">Welcome to the Forum</h2>
          <p className="max-w-md mx-auto">
            This is where the community shares teachings, asks questions,
            and coordinates gatherings. Fresh start for the frontend!
          </p>
        </div>
      </div>
    </main>
  );
}