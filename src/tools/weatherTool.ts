import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Hardcoded weather data for demo purposes
const weatherData: Record<string, { temperature: number; condition: string; humidity: number }> = {
  "new york": { temperature: 72, condition: "Sunny", humidity: 45 },
  "london": { temperature: 58, condition: "Cloudy", humidity: 78 },
  "tokyo": { temperature: 68, condition: "Partly Cloudy", humidity: 60 },
  "paris": { temperature: 65, condition: "Rainy", humidity: 82 },
  "sydney": { temperature: 77, condition: "Clear", humidity: 55 },
  "mumbai": { temperature: 88, condition: "Humid", humidity: 85 },
  "singapore": { temperature: 86, condition: "Thunderstorms", humidity: 90 },
};

export class WeatherTool extends StructuredTool {
  name = "get_weather";
  description = "Get the current weather for a specified city. Returns temperature in Fahrenheit, weather condition, and humidity percentage.";

  schema = z.object({
    city: z.string().describe("The name of the city to get weather for"),
  });

  async _call({ city }: { city: string }): Promise<string> {
    const normalizedCity = city.toLowerCase().trim();
    const weather = weatherData[normalizedCity];

    if (weather) {
      return JSON.stringify({
        city: city,
        temperature: `${weather.temperature}°F`,
        condition: weather.condition,
        humidity: `${weather.humidity}%`,
      });
    }

    return JSON.stringify({
      city: city,
      error: "Weather data not available for this city",
      available_cities: Object.keys(weatherData),
    });
  }
}
