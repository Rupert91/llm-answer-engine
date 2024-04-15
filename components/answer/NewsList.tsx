import React, { useState, useEffect } from 'react';

interface NewsItem {
    position: number;
    title: string;
    link: string;
    snippet: string;
    relevance_score: number;
    Reason: string;
    content_depth: string;
    accuracy_score: string;
}

interface NewsListProps {
    llmResponseString: string;
}

const NewsList: React.FC<NewsListProps> = ({ llmResponseString }) => {
    const [finalResults, setFinalResults] = useState<any>([]);

    useEffect(() => {
        // Find the index of the actual JSON array start
        const startIndex = llmResponseString.indexOf('[');
        const cleanJson = llmResponseString.substring(startIndex);
        console.log("cleanJson",cleanJson)

        try {
            const parsedData:any = []; //  cleanJson  // as NewsItem[];
            setFinalResults(parsedData);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            setFinalResults([]); // Reset on error
        }
    }, [llmResponseString]);

    return (
        <div>
            <h1>News List</h1>
            <ul>
                {finalResults.map((item:any, index:any) => (
                    <li key={index}>
                        <h2>{item.title} (Position: {item.position})</h2>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">Read more</a>
                        <p>{item.snippet}</p>
                        <strong>Relevance Score:</strong> {item.relevance_score}<br />
                        <strong>Reason:</strong> {item.Reason}<br />
                        <strong>Content Depth:</strong> {item.content_depth}<br />
                        <strong>Accuracy Score:</strong> {item.accuracy_score}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default NewsList;
