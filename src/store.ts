import { JSONObject, JSONValue } from "./json-types";
import "reflect-metadata";

export type Permission = "r" | "w" | "rw" | "none";

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): any;
  write(path: string, value: JSONValue): JSONValue | IStore;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export type RestrictedProperty = {
  key: string;
  readable: boolean;
  writable: boolean;
}

export function Restrict(permission?:Permission): any  {
  return (target: Store, propertyKey: string ) => { 
    let value:any;
    // TODO  default permissions
    // const permission:Permission = assignedPermission || Object.getOwnPropertyDescriptor(target, 'defaultPolicy')!.value;
    const readable:boolean = permission == 'r' || permission == "rw";
    const writable:boolean = permission == 'w' || permission == "rw";

    const restrictedProperties:RestrictedProperty[] = Reflect.getMetadata ('restrictedProperties', target) || [];
    if (!restrictedProperties.find(value => value.key == propertyKey)) {
      restrictedProperties.push({
        key: propertyKey,
        readable: readable,
        writable: writable
      })
    }

    Reflect.defineMetadata('restrictedProperties', restrictedProperties, target)

    const getter = function() {
      return value;
    };
    const setter = function(newValue: any) {
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      set: setter,
      get: getter,
      configurable: true
    });
  }
}
export class Store implements IStore {
  defaultPolicy: Permission = "rw";

  constructor () {

  }

  allowedToRead(key: string): boolean {
    const restrictedProperty:RestrictedProperty = Reflect.getMetadata('restrictedProperties', this)?.find((value:RestrictedProperty) => value.key == key)
    if(!restrictedProperty){
      // fallback to default policy
      return this.defaultPolicy == 'r' || this.defaultPolicy == 'rw';
    }else{
      return restrictedProperty.readable
    }
  }

  allowedToWrite(key: string): boolean {
    console.log(key)
    console.log(this.defaultPolicy)
    const restrictedProperty:RestrictedProperty = Reflect.getOwnMetadata('restrictedProperties', this)?.find((value:RestrictedProperty) => value.key == key)
    if(!restrictedProperty){
      // fallback to default policy
      return  this.defaultPolicy == 'w' || this.defaultPolicy == 'rw';
    }else{
      return restrictedProperty.writable
    }
  }

  read(path: string): any {
    const segments:string[] = path.split(':', 2);
    const firstKey:string = segments[0];
    const remainingPath:string = segments[1];

    if(segments.length > 1) {
      if(typeof (this as any)[firstKey] === 'function'){
        return (this as any)[firstKey]().read(remainingPath)
      }else{
        return (this as any)[firstKey].read(remainingPath)
      }
    }else {
      if(!this.allowedToRead(firstKey)){
        throw new Error("Read Access Denied");
      }
      return this[firstKey as keyof Store];
    }
  }

  write(path: string, value: JSONValue): JSONValue | IStore {
    const segments:string[] = path.split(':', 2);
    const firstKey:string = segments[0];
    const remainingPath:string = segments[1];
    if(segments.length > 1) {
      if(((this as any)[firstKey] instanceof Store) ){
        (this as any)[firstKey].write(remainingPath, value)
      }else{
        if(!this.allowedToWrite(firstKey)){
          throw new Error("Write Access Denied");
        }
        (this as any)[firstKey] = new Store();
        (this as any)[firstKey].write(remainingPath, value);
      }
      return (this as any)[firstKey];
    }else {
      if(!this.allowedToWrite(firstKey)){
        throw new Error("Write Access Denied");
      }
      return (this as any)[firstKey] = value;
    } 
  }

  writeEntries(entries: JSONObject): void {
    for (const key in entries) {
      this.write(key, entries[key])
    }
  }

  entries(): JSONObject {
    throw new Error("Method not implemented.");
  }
}
