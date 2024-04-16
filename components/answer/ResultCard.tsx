import React from 'react';


interface InfoCardProps {
  title: string;
  position: string;
  snippet: string;
  link: string;
}


const InfoCard = ({ title, position, snippet, link }: InfoCardProps) => {
    return (
    <a href={link} className="block bg-white border border-gray-300 shadow-md rounded-lg p-4 m-4 hover:bg-gray-50 transition duration-300">
      <h2 className="text-lg text-gray-900 font-bold mb-2">{title}</h2>
      <h4 className="text-md text-gray-700 font-semibold mb-1">{position}</h4>
      <p className="text-gray-600 text-base mb-3">{snippet}</p>
      <span className="text-blue-500 hover:text-blue-600">Read More</span>
    </a>
  );
};

export default InfoCard;
