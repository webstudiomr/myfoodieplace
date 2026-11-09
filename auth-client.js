(function(){
  const loginPage=location.pathname.endsWith("/login.html");
  const recoveryHash=location.hash.includes("type=recovery")||location.hash.includes("type=signup");
  if(!loginPage&&recoveryHash){location.replace("/login.html"+location.search+location.hash);return;}
  let client=null;
  const ready=(async()=>{
    const response=await fetch("/api/auth-config",{cache:"no-store"});
    const config=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(config.error||"Could not load authentication settings.");
    if(!window.supabase?.createClient)throw new Error("Secure login library could not be loaded.");
    client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});
    if(loginPage)return true;
    if(location.pathname.endsWith("/admin.html")){
      const {data:{session}}=await client.auth.getSession();
      if(!session){location.replace("/login.html");return false;}
      const check=await fetch("/api/admin-session",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      if(!check.ok){await client.auth.signOut();location.replace("/login.html");return false;}
      const sessionInfo=await check.json().catch(()=>({}));
      const developerPanel=document.getElementById("developerToolsPanel");
      if(developerPanel)developerPanel.hidden=sessionInfo.user?.role!=="developer";
      const app=document.querySelector(".admin-page .app");if(app)app.style.display="";
    }
    return true;
  })().catch(error=>{
    console.error("Foodie Place authentication:",error);
    if(!loginPage&&location.pathname.endsWith("/admin.html"))location.replace("/login.html");
    const status=document.getElementById("authStatus");if(status)status.textContent=error.message||"Authentication is unavailable.";
    return false;
  });
  window.foodieAdminAuth={
    get ready(){return ready},
    get client(){return client},
    async getAccessToken(){if(!(await ready)||!client)return null;const {data:{session}}=await client.auth.getSession();return session?.access_token||null;},
    async signOut(){if(client){const {error}=await client.auth.signOut();if(error)throw error;}}
  };
})();