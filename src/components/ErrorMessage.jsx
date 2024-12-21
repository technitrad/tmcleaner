export default function ErrorMessage({ message }) {
    return (
      <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
        {message}
      </div>
    )
  }