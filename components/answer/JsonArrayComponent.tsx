import React from 'react';

// 引入接口定义
interface LLMResponseComponentProps {
    llmResponse: string;
    currentLlmResponse: string;
    index: number;
}

const JsonArrayComponent: React.FC<Pick<LLMResponseComponentProps, 'llmResponse'>> = ({ llmResponse }) => {
  let finalResults = [];
  try {
    const parsedResults = JSON.parse(llmResponse);

    if (!Array.isArray(parsedResults) || parsedResults.some(item =>
      typeof item.title !== 'string' ||
      typeof item.link !== 'string' ||
      typeof item.snippet !== 'string' ||
      typeof item.position !== 'number' ||
      typeof item.relevance_score !== 'number' ||
      typeof item.Reason !== 'string')) {
      throw new Error("API response format is invalid or missing required fields");
    }

    finalResults = parsedResults.map(item => ({
      title: item.title || "",
      link: item.link || "",
      snippet: item.snippet || "",
      position: item.position,
      relevance_score: item.relevance_score,
      Reason: item.Reason
    }));

  } catch (error) {
    console.error('Error processing the JSON response:', error);
    return <p>Error processing results.</p>;
  }

  return (
    <div className="results-container">
      {finalResults.length > 0 ? (
        <ul>
          {finalResults.map((item, index) => (
            <li key={index}>
              <h3>{item.title}</h3>
              <p>{item.snippet}</p>
              <a href={item.link} target="_blank" rel="noopener noreferrer">Read more</a>
              <p>Position: {item.position}</p>
              <p>Relevance Score: {item.relevance_score.toFixed(2)}</p>
              <p>Reason: {item.Reason}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No results found.</p>
      )}
    </div>
  );
};

export default JsonArrayComponent;
