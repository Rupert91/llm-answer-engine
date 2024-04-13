// 1. Import dependencies
'use action';

import { createAI, createStreamableValue } from 'ai/rsc';
import { OpenAI } from 'openai';
import cheerio from 'cheerio';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document as DocumentInterface } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
// 1.5 Configuration file for inference model, embeddings model, and other parameters
import { config } from './config';
// 2. Determine which embeddings mode and which inference model to use based on the config.tsx. Currently suppport for OpenAI, Groq and partial support for Ollama embeddings and inference
let openai: OpenAI;
if (config.useOllamaInference) {
  openai = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama'
  });
} else {
  openai = new OpenAI({
    baseURL: config.nonOllamaBaseURL,
    apiKey: config.inferenceAPIKey
  });
}
// 2.5 Set up the embeddings model based on the config.tsx
let embeddings: OllamaEmbeddings | OpenAIEmbeddings;
if (config.useOllamaEmbeddings) {
  embeddings = new OllamaEmbeddings({
    model: config.embeddingsModel,
    baseUrl: "http://localhost:11434"
  });
} else {
  embeddings = new OpenAIEmbeddings({
    modelName: config.embeddingsModel
  });
}
// 3. Define interfaces for search results and content results
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  favicon: string;
}
interface ContentResult extends SearchResult {
  html: string;
}
interface ParsedQuery {
  topic: string;
  mediaType: string;
  numResults: number;
};

// 定义FinalResult类型
interface finalResults {
  title: string;
  link: string;
  snippet: string;
  position: number;
};

//* 
async function parseUserQuery(message: string): Promise<ParsedQuery> {
  try {
    const response = await openai.chat.completions.create({
      model: config.inferenceModel,
      messages: [
        {
          role: "system",
          content: `Your task is to analyze the user query and generate a response detailing the query's main topic, the preferred media type for the results(e.g articles/podcast/social media), and the number of desired results. Please format your response as a JSON object. For example, your response should look like this: "{\\"topic\\": \\"Climate Change\\", \\"mediaType\\": \\"Articles\\", \\"numResults\\": 5}". Note: Ensure to return 'numResults' as a number, not a string.`
        },
        {
          role: "user",
          content: message
        }
      ],
    });

    // 解析模型的响应
    const jsonString = response.choices?.[0]?.message?.content?.trim();
    if (!jsonString) {
      throw new Error("No response from OpenAI");
    }

    // 尝试解析响应字符串为JSON
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error("Failed to parse JSON response from OpenAI");
    }

    // 验证解析后的对象是否包含必要的字段
    if (typeof jsonResponse.topic !== 'string' ||
        typeof jsonResponse.mediaType !== 'string' ||
        typeof jsonResponse.numResults !== 'number') {
      throw new Error("API response format is invalid or missing required fields");
    }

    // 构建并返回ParsedQuery对象
    const pQuery: ParsedQuery = {
      topic: jsonResponse.topic,
      mediaType: jsonResponse.mediaType,
      numResults: jsonResponse.numResults
    };

    return pQuery;
  } catch (error) {
    console.error('Error parsing user query:', error);
    throw error;
  }
}


// 4. Fetch search results from Brave Search API
async function getSources(Pquery: ParsedQuery, numberOfPagesToScan = config.numberOfPagesToScan): Promise<SearchResult[]> {
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(Pquery.topic)}&count=${numberOfPagesToScan}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY as string
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const jsonResponse = await response.json();
    if (!jsonResponse.web || !jsonResponse.web.results) {
      throw new Error('Invalid API response format');
    }
    const final = jsonResponse.web.results.map((result: any): SearchResult => ({
      title: result.title,
      link: result.url,
      snippet: result.description,
      favicon: result.profile.img
    }));
    return final;
  } catch (error) {
    console.error('Error fetching search results:', error);
    throw error;
  }
}
// 5. Fetch contents of top 10 search results
async function get10BlueLinksContents(sources: SearchResult[]): Promise<ContentResult[]> {
  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 1000): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (error) {
        console.log(`Skipping ${url}!`);
      }
      throw error;
    }
  }
  function extractMainContent(html: string): string {
    try {
      const $ = cheerio.load(html);
      $("script, style, head, nav, footer, iframe, img").remove();
      return $("body").text().replace(/\s+/g, " ").trim();
    } catch (error) {
      console.error('Error extracting main content:', error);
      throw error;
    }
  }
  const promises = sources.map(async (source): Promise<ContentResult | null> => {
    try {
      const response = await fetchWithTimeout(source.link, {}, 1000);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${source.link}. Status: ${response.status}`);
      }
      const html = await response.text();
      const mainContent = extractMainContent(html);
      return { ...source, html: mainContent };
    } catch (error) {
      // console.error(`Error processing ${source.link}:`, error);
      return null;
    }
  });
  try {
    const results = await Promise.all(promises);
    return results.filter((source): source is ContentResult => source !== null);
  } catch (error) {
    console.error('Error fetching and processing blue links contents:', error);
    throw error;
  }
}
// 6. Process and vectorize content using LangChain
async function processAndVectorizeContent(
  contents: ContentResult[],
  query: string,
  textChunkSize = config.textChunkSize,
  textChunkOverlap = config.textChunkOverlap,
  numberOfSimilarityResults = config.numberOfSimilarityResults,
): Promise<DocumentInterface[]> {
  try {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      if (content.html.length > 0) {
        try {
          const splitText = await new RecursiveCharacterTextSplitter({ chunkSize: textChunkSize, chunkOverlap: textChunkOverlap }).splitText(content.html);
          const vectorStore = await MemoryVectorStore.fromTexts(splitText, { title: content.title, link: content.link }, embeddings);
          return await vectorStore.similaritySearch(query, numberOfSimilarityResults);
        } catch (error) {
          console.error(`Error processing content for ${content.link}:`, error);
        }
      }
    }
    return [];
  } catch (error) {
    console.error('Error processing and vectorizing content:', error);
    throw error;
  }
}
// 7. Fetch image search results from Brave Search API
async function getImages(message: string): Promise<{ title: string; link: string }[]> {
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/images/search?q=${message}&spellcheck=1`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY as string
      }
    });
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status}`);
    }
    const data = await response.json();
    const validLinks = await Promise.all(
      data.results.map(async (result: any) => {
        const link = result.properties.url;
        if (typeof link === 'string') {
          try {
            const imageResponse = await fetch(link, { method: 'HEAD' });
            if (imageResponse.ok) {
              const contentType = imageResponse.headers.get('content-type');
              if (contentType && contentType.startsWith('image/')) {
                return {
                  title: result.properties.title,
                  link: link,
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching image link ${link}:`, error);
          }
        }
        return null;
      })
    );
    const filteredLinks = validLinks.filter((link): link is { title: string; link: string } => link !== null);
    return filteredLinks.slice(0, 9);
  } catch (error) {
    console.error('There was a problem with your fetch operation:', error);
    throw error;
  }
}
// 8. Fetch video search results from Google Serper API
async function getVideos(message: string): Promise<{ imageUrl: string, link: string }[] | null> {
  const url = 'https://google.serper.dev/videos';
  const data = JSON.stringify({
    "q": message
  });
  const requestOptions: RequestInit = {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API as string,
      'Content-Type': 'application/json'
    },
    body: data
  };
  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status}`);
    }
    const responseData = await response.json();
    const validLinks = await Promise.all(
      responseData.videos.map(async (video: any) => {
        const imageUrl = video.imageUrl;
        if (typeof imageUrl === 'string') {
          try {
            const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
            if (imageResponse.ok) {
              const contentType = imageResponse.headers.get('content-type');
              if (contentType && contentType.startsWith('image/')) {
                return { imageUrl, link: video.link };
              }
            }
          } catch (error) {
            console.error(`Error fetching image link ${imageUrl}:`, error);
          }
        }
        return null;
      })
    );
    const filteredLinks = validLinks.filter((link): link is { imageUrl: string, link: string } => link !== null);
    return filteredLinks.slice(0, 9);
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}
// 9. Generate follow-up questions using OpenAI API
// const relevantQuestions = async (sources: SearchResult[]): Promise<any> => {
//   return await openai.chat.completions.create({
//     messages: [
//       {
//         role: "system",
//         content: `
//           You are a Question generator who generates an array of 3 follow-up questions in JSON format.
//           The JSON schema should include:
//           {
//             "original": "The original search query or context",
//             "followUp": [
//               "Question 1",
//               "Question 2", 
//               "Question 3"
//             ]
//           }
//           `,
//       },
//       {
//         role: "user",
//         content: `Generate follow-up questions based on the top results from a similarity search: ${JSON.stringify(sources)}. The original search query is: "The original search query".`,
//       },
//     ],
//     model: config.inferenceModel,
//     response_format: { type: "json_object" },
//   });
// };

const sortAndFilterResults = async (sources: SearchResult[]): Promise<finalResults[]> => {
  try {
    const response = await openai.chat.completions.create({
      model: config.inferenceModel,
      messages: [
        {
          role: "system",
          content: `
          You are an advanced AI tasked with organizing a list of search results based on their relevance to a user's query. Your objective is to sort these results in a way that they provide maximum value to the user, highlighting the most pertinent information first.

          After analyzing the given search results, which include details such as titles, snippets, and links, output a JSON array named 'finalResults'. This array should list the results in order of their relevance and usefulness, from most to least recommended.
          
          Each item in 'finalResults' must be a JSON object that includes the following properties: 'title', 'link', 'snippet',  and 'position'. The 'position' field should indicate the rank or order of each result based on its relevance. If any of these properties are missing from a source, represent them with an empty string ("").
          
          For clarity, here is an example of what an item in 'finalResults' might look like:
          [
            {
              "position": 1,
              "title": "Example Title 1",
              "link": "http://example.com/1",
              "snippet": "This is an example snippet from the first result.",
            },

            // More results...
          ]
          
          Your primary goal is to ensure that the results are meticulously ordered to assist users in finding the most accurate and helpful information quickly. Please proceed with analyzing and ordering the search results accordingly.
          `,
        },
        {
          role: "user",
          content: `Here are the search results. The original user query is "{(message)}". Please sort them according to the rules.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    // Return the entire response for external processing
    const responseString = response.choices?.[0]?.message?.content?.trim();
    if (!responseString) {
      throw new Error("No response from OpenAI");
    }
  
    // 尝试解析响应字符串为JSON
    let parsedResults;
    try {
      parsedResults = JSON.parse(responseString);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error("Failed to parse JSON response from OpenAI");
    }
  
    // 验证解析后的数组是否符合期望的格式
    if (!Array.isArray(parsedResults) || parsedResults.some(item => 
        typeof item.title !== 'string' ||
        typeof item.link !== 'string' ||
        typeof item.snippet !== 'string' ||
        typeof item.position !== 'number')) {
          throw new Error("API response format is invalid or missing required fields");
        }
  
      // 构建并返回finalResults数组，不包含favicon字段
      const finalResults = parsedResults.map(item => ({
        title: item.title || "",
        link: item.link || "",
        snippet: item.snippet || "",
        position: item.position
      }));

      return finalResults;
    } catch (error) {
      console.error('Error processing the response:', error);
      throw error;
    };
  }
// 10. Main action function that orchestrates the entire process
async function myAction(userMessage: string): Promise<any> {
  "use server";
  const streamable = createStreamableValue({});
  const overallStartTime = Date.now();  // 记录总体开始时间

  (async () => {
    const startTimeParseQuery = Date.now();
    const processedQuery = await parseUserQuery(userMessage);
    const endTimeParseQuery = Date.now();
    const parseQueryTime =(endTimeParseQuery - startTimeParseQuery)/1000;

    streamable.update({ 'parseQueryTime': parseQueryTime }); 

    const num = processedQuery.numResults; // 从processedQuery中获取numResults
    const numResults = Number(num);

    streamable.update({ 'numResults': numResults }); 

    const startTimeFetchData = Date.now();
    const [images, sources, videos] = await Promise.all([
      getImages(userMessage),
      getSources(processedQuery),
      getVideos(userMessage),
    ]);
    const endTimeFetchData = Date.now();
    const searchTime = (endTimeFetchData - startTimeFetchData)/1000;
    console.log(`获取数据耗时：${endTimeFetchData - startTimeFetchData}ms`);

    streamable.update({ 'searchResults': sources });
    streamable.update({ 'images': images });
    streamable.update({ 'videos': videos });
    streamable.update({ 'searchTime': searchTime });

    const html = await get10BlueLinksContents(sources);
    const vectorResults = await processAndVectorizeContent(html, userMessage);
    
    const startTimeChatCompletion = Date.now();
    const chatCompletion = await openai.chat.completions.create({
      messages:
        [{
          role: "system", content: `
            - As an advanced AI, you are tasked with analyzing and organizing a list of search results based on their relevance to the user's provided query. The search results are presented as follows: ${JSON.stringify(sources)}.
            Your primary objective is not merely to sort these results by their original order, but to dynamically rank them according to how well they match the user's query on various dimensions such as relevance, content depth, and accuracy.
            Each result in 'finalResults' must be a structured JSON object that includes the following properties: 'title', 'link', 'snippet', and 'position'. The 'position' field should dynamically indicate the rank or order of each result, based on an intelligent analysis of its content and relevance to the query provided.
            If any properties are missing from a source, represent them with an empty string ("").
            
            Here is an example of what an item in 'finalResults' might look like:
            [
              {
                "position": 1,
                "title": "Investing Explained: Types of Investments and How To Get Started",
                "link": "https://www.investopedia.com/terms/i/investing.asp",
                "snippet": "This article provides a comprehensive overview of the types of investments available today, helping beginners understand where they might start.",
                "relevance_score": 0.95
              },
              // More intelligently sorted results...
            ]
            Please ensure that your sorting algorithm takes into account the detailed content of each source, rather than relying on a simple sequential order.`
        },
        {
          role: "user", content: `Here is my query "${JSON.stringify(processedQuery)}". Based on this query,ignore the numResults mentioned in this query and please intelligently sort all the sources by relevance, content depth, and query match. Ensure that the most relevant sources appear first. Output the sorted sources in a JSON array named 'finalResults'.`
        },        
        ], stream: true, model: config.inferenceModel
    });
    for await (const chunk of chatCompletion) {
      if (chunk.choices[0].delta && chunk.choices[0].finish_reason !== "stop") {
        streamable.update({ 'llmResponse': chunk.choices[0].delta.content });
      } else if (chunk.choices[0].finish_reason === "stop") {
        streamable.update({ 'llmResponseEnd': true });
        break;
      }
    }
  // 在这里，finalResults 已经是包含了所需数据的数组
    const endTimeChatCompletion = Date.now();
    console.log(`聊天完成处理耗时：${endTimeChatCompletion - startTimeChatCompletion}ms`);
    const chatTime = (endTimeChatCompletion - startTimeChatCompletion) / 1000;
    streamable.update({ 'chatTime': chatTime });

    const overallEndTime = Date.now();  // 记录总体结束时间
    console.log(`总执行时间：${overallEndTime - overallStartTime}ms`);
    streamable.update({ 'executionTime': overallEndTime - overallStartTime });
    streamable.done({ status: 'done' });
  })();
  return streamable.value;
}
// 11. Define initial AI and UI states
const initialAIState: {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  id?: string;
  name?: string;
}[] = [];
const initialUIState: {
  id: number;
  display: React.ReactNode;
}[] = [];
// 12. Export the AI instance
export const AI = createAI({
  actions: {
    myAction
  },
  initialUIState,
  initialAIState,
});
