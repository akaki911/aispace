
import React from 'react';
import { useNavigate } from 'react-router-dom';
import CottageForm from '../../CottageForm';
import { ArrowLeft } from 'lucide-react';

export default function NewCottagePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            უკან დაბრუნება
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            ახალი კოტეჯის დამატება
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            შეავსეთ ყველა სავალდებულო ველი კოტეჯის დასარეგისტრირებლად
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
          <CottageForm />
        </div>
      </div>
    </div>
  );
}
