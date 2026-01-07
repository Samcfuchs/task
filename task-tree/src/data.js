const testData = 
[
 { "title": "Renew license", "description": "", "priority": 2, "id": "x0", "dependsOn": [], "status":"not started"}
,{ "title": "Renew license 1", "description": "", "priority": 2, "id": "x1", "dependsOn": [], "status":"not started"}
,{ "title": "Renew license 2", "description": "", "priority": 2, "id": "x2", "dependsOn": [], "status":"not started"}
,{ "title": "Renew license 3", "description": "", "priority": 2, "id": "x3", "dependsOn": [], "status":"not started"}
,{ "title": "Renew license 4", "description": "", "priority": 2, "id": "x4", "dependsOn": [], "status":"not started"}
,{ "title": "Renew license 5", "description": "", "priority": 2, "id": "x5", "dependsOn": [], "status":"not started"}
,{ "title": "Renew license 6", "description": "", "priority": 2, "id": "x6", "dependsOn": [], "status":"not started"}
,{ "title": "Renew license a", "description": "", "priority": 2, "id": "a", "dependsOn": ['b'], "status":"not started"}
,{ "title": "Renew license b", "description": "", "priority": 2, "id": "b", "dependsOn": [], "status":"complete"}
,{ "title": "Renew license b", "description": "", "priority": 4, "id": "c", "dependsOn": ['b'], "status":"not started"}
]

const testDict = {
 "x0": { "title": "Renew license", "description": "", "priority": 2, "id": "x0", "dependsOn": [], "status":"not started"}
,"x1": { "title": "Renew license 1", "description": "", "priority": 2, "id": "x1", "dependsOn": [], "status":"not started"}
,"x2": { "title": "Renew license 2", "description": "", "priority": 5, "id": "x2", "dependsOn": [], "status":"not started"}
,"x3": { "title": "Renew license 3", "description": "", "priority": 2, "id": "x3", "dependsOn": [], "status":"not started"}
,"x4": { "title": "Renew license 4", "description": "", "priority": 2, "id": "x4", "dependsOn": [], "status":"not started"}
,"x5": { "title": "Renew license 5", "description": "", "priority": 1, "id": "x5", "dependsOn": [], "status":"not started"}
,"x6": { "title": "Renew license 6", "description": "", "priority": 2, "id": "x6", "dependsOn": [], "status":"not started"}
,"b": { "title": "Renew license b", "description": "", "priority": 2, "id": "b", "dependsOn": [], "status":"complete"}
,"i": { "title": "Renew license b", "description": "", "priority": 3, "id": "i", "dependsOn": [], "status":"complete"}
,"a": { "title": "Renew license a", "description": "", "priority": 2, "id": "a", "dependsOn": ['b'], "status":"not started"}
,"c": { "title": "Renew license b", "description": "", "priority": 4, "id": "c", "dependsOn": ['a'], "status":"not started"}
,"d": { "title": "Renew license a", "description": "", "priority": 2, "id": "d", "dependsOn": ['c'], "status":"not started", "isExternal": true}
,"e": { "title": "Renew license a", "description": "", "priority": 3, "id": "e", "dependsOn": ['d'], "status":"not started"}
,"f": { "title": "Renew license f", "description": "", "priority": 2, "id": "f", "dependsOn": ['d'], "status":"not started"}
,"g": { "title": "Renew license a", "description": "", "priority": 2, "id": "g", "dependsOn": [], "status":"not started"}
,"h": { "title": "Renew license a", "description": "", "priority": 2, "id": "h", "dependsOn": [], "status":"not started"}
,"j": { "title": "Renew license a", "description": "", "priority": 2, "id": "j", "dependsOn": ['e'], "status":"not started"}
}

export {testData, testDict};
