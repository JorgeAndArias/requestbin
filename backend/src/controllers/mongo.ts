import mongoose from "mongoose";
import { RequestBody } from "../types";
import path from "path";
require('dotenv').config();

class MongoClient {
  private requestBodyModel: mongoose.Model<RequestBody>;

  constructor() {
    const schema = new mongoose.Schema<RequestBody>({
      request: mongoose.Schema.Types.String,
    });

    this.requestBodyModel = this.createModel(schema);
  }

  private createSchema(schema: mongoose.Schema): mongoose.Schema {
    schema.set("toJSON", {
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
      },
    });

    return schema;
  }

  private createModel(schema: mongoose.Schema): mongoose.Model<RequestBody> {
    const jsonSchema = this.createSchema(schema);
    const modelName = "RequestBody";

    if (mongoose.models[modelName]) {
      return mongoose.models[modelName] as mongoose.Model<RequestBody>;
    }

    return mongoose.model<RequestBody>("RequestBody", jsonSchema);
  }

  public async connectToDatabase(): Promise<void> {
    const username = encodeURIComponent(process.env.MONGO_USERNAME ?? "");
    const password = encodeURIComponent(process.env.MONGO_PASSWORD ?? "");
    const host = process.env.MONGO_HOST ?? "";
    const dbName = process.env.MONGO_DB_NAME ?? "";
    const retryWrites = process.env.MONGO_RETRY_WRITES ?? "false";
    const tls = process.env.MONGO_TLS ?? "true";
    const tlsCAFile = process.env.MONGO_TLS_CA_FILE ?? "global-bundle.pem";
    const replicaSet = process.env.MONGO_REPLICA_SET ?? "rs0";
    const readPreference = process.env.MONGO_READ_PREFERENCE ?? "secondaryPreferred";

    const tlsCAFilePath = path.resolve(__dirname, `../${tlsCAFile}`);

    const uri = `mongodb://${username}:${password}@${host}/${dbName}?` +
      `tls=${tls}` +
      `&replicaSet=${replicaSet}` +
      `&readPreference=${readPreference}` +
      `&retryWrites=${retryWrites}`;

    try {
      if (mongoose.connection.readyState !== 1) {
        console.log(uri);
	await mongoose.connect(uri, {
          tlsCAFile: tlsCAFilePath,
          tls: tls === "true",
          authMechanism: "SCRAM-SHA-1",
          retryWrites: retryWrites === "true",
        });
        console.log("Connected to MongoDB");
      }
    } catch (error: any) {
      console.error(`Error connecting to MongoDB: ${error.message}`);
    }
  }

  public getModel(): mongoose.Model<RequestBody> {
    return this.requestBodyModel;
  }

  public async saveRequestBody(requestBody: any): Promise<string> {
    try {
      const newRequestBody = new this.requestBodyModel({
        request: requestBody,
      });
      const saved = await newRequestBody.save();
      return saved.toJSON().id!;
    } catch (error) {
      console.error("MongoDB: Error saving request:", error);
      throw new Error("MongoDB: Failed to save request body");
    }
  }

  public async getRequestBody(bodyMongoId: string) {
    try {
      const requestSaved = await this.requestBodyModel.findOne({
        _id: bodyMongoId,
      });
      if (!requestSaved) {
        throw new Error("MongoDB: Request not found");
      }
      return requestSaved.request;
    } catch (error) {
      console.error("MongoDB: Error fetching request body:", error);
      throw error;
    }
  }

  public async deleteBodyRequests(ids: string[]): Promise<boolean> {
    try {
      const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
      await this.requestBodyModel.deleteMany({
        _id: { $in: objectIds },
      });
      return true;
    } catch (error) {
      console.error("MongoDB: Error deleting request bodies:", error);
      return false;
    }
  }

  public async closeConnection(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
      }
    } catch (error: any) {
      console.error("Error disconnecting from MongoDB:", error.message);
      throw new Error("Failed to close MongoDB connection");
    }
  }
}

const mongo = new MongoClient();
mongo.connectToDatabase();

export default MongoClient;
